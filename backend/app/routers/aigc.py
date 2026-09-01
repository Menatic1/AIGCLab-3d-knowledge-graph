"""AIGC 能力路由：
- POST /api/aigc/generate     围绕课程主题，调用大模型直接生成知识图谱并入库
- POST /api/aigc/resources/suggest  针对单个知识点，调用大模型生成学习资源建议
- GET  /api/aigc/bilibili-videos    搜索B站相关教学视频
"""
from __future__ import annotations

import hashlib
import re
import time
import uuid
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..llm_client import generate_graph_by_topic, suggest_learning_resources

router = APIRouter(prefix="/api/aigc", tags=["aigc"])


class GenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200, description="课程主题，如「计算机网络」")
    model: str | None = Field(None, description="可选，覆盖默认模型")


class SuggestRequest(BaseModel):
    node_name: str = Field(..., min_length=1, max_length=200)
    category: str | None = None
    description: str | None = None
    model: str | None = None


def _upsert_graph_result(
    db: Session, result, *, graph_id: str, user_id: str, document_id=None,
) -> None:
    """把 ExtractResult 写入 KGNode/KGRelation（按 id upsert）。

    节点 ID 加 graph_id 前缀避免跨图谱冲突。
    """
    prefix = f"{graph_id[:8]}_"  # 短前缀，保持节点 id 可读
    id_map: dict[str, str] = {}  # 原始 id -> 加前缀后的全局唯一 id

    node_map: dict[str, models.KGNode] = {}
    for n in result.nodes:
        orig_id = n["id"]
        new_id = f"{prefix}{orig_id}"
        id_map[orig_id] = new_id
        row = db.query(models.KGNode).filter(models.KGNode.id == new_id).first()
        if row:
            row.name = n["name"]
            row.category = n["category"]
            row.description = n["description"]
            row.difficulty = float(n.get("difficulty") or 3.0)
            row.graph_id = graph_id
            row.user_id = user_id
        else:
            row = models.KGNode(
                id=new_id, name=n["name"], category=n["category"],
                description=n["description"], difficulty=float(n.get("difficulty") or 3.0),
                document_id=document_id, graph_id=graph_id, user_id=user_id,
            )
            db.add(row)
        node_map[row.id] = row
    db.flush()

    for r in result.relations:
        src = id_map.get(r["source"])
        tgt = id_map.get(r["target"])
        if not src or not tgt:
            continue
        new_rel_id = f"{prefix}{r['id']}"
        row = db.query(models.KGRelation).filter(models.KGRelation.id == new_rel_id).first()
        if row:
            row.source = src
            row.target = tgt
            row.type = r["type"]
            row.label = r["label"]
            row.graph_id = graph_id
            row.user_id = user_id
        else:
            db.add(models.KGRelation(
                id=new_rel_id, source=src, target=tgt,
                type=r["type"], label=r["label"], document_id=document_id,
                graph_id=graph_id, user_id=user_id,
            ))
    db.commit()


@router.post("/generate")
async def generate_graph(
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """围绕课程主题，调用大模型生成知识图谱，写入数据库并返回。

    每次生成都会创建一份独立的 KnowledgeGraph 记录，节点 ID 加前缀避免冲突。
    """
    result = await generate_graph_by_topic(payload.topic, model=payload.model)

    # 创建一份独立的图谱元数据记录
    graph_id = uuid.uuid4().hex
    g = models.KnowledgeGraph(
        id=graph_id,
        user_id=user.id,
        title=payload.topic,
        source="aigc",
        source_ref=payload.topic,
        description=f"AIGC 围绕「{payload.topic}」自动生成的知识图谱",
        nodes_count=len(result.nodes),
        relations_count=len(result.relations),
    )
    db.add(g)
    db.commit()

    if result.nodes:
        _upsert_graph_result(db, result, graph_id=graph_id, user_id=user.id, document_id=None)
        # 重新统计计数（防 upsert 时漏计）
        from .graphs import _refresh_counts
        _refresh_counts(db, graph_id)

    # 返回时把节点/关系 id 还原成「原始 id」，方便前端 mapBackendGraph 不感知前缀
    # （前端 GraphPage 加载时会通过 GET /api/graphs/{id} 拿到真实带前缀 id，
    #   这里只在「生成后立即注入」的旧路径上提供去前缀版本，保持向下兼容）
    prefix = f"{graph_id[:8]}_"
    raw_nodes = [
        {**n, "id": n["id"][len(prefix):] if n["id"].startswith(prefix) else n["id"]}
        for n in result.nodes
    ]
    raw_rels = [
        {
            **r,
            "id": r["id"][len(prefix):] if r["id"].startswith(prefix) else r["id"],
            "source": r["source"][len(prefix):] if r["source"].startswith(prefix) else r["source"],
            "target": r["target"][len(prefix):] if r["target"].startswith(prefix) else r["target"],
        }
        for r in result.relations
    ]

    return {
        "graph_id": graph_id,
        "topic": payload.topic,
        "nodes": raw_nodes,
        "relations": raw_rels,
        "summary": result.raw_summary,
        "used_llm": result.used_llm,
        "nodes_count": len(result.nodes),
        "relations_count": len(result.relations),
    }


@router.post("/resources/suggest")
async def suggest_resources(payload: SuggestRequest):
    """针对单个知识点，调用大模型生成学习资源建议。"""
    return await suggest_learning_resources(
        payload.node_name,
        payload.category or "",
        payload.description or "",
        model=payload.model,
    )


# ── B站视频搜索 ──────────────────────────────────────────────

# Bilibili WBI 签名用的固定置换表
_MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 36, 25, 66, 40, 26, 6, 20, 51, 54, 16, 17, 22, 24, 44, 61,
    0, 67, 30, 62, 63, 60, 64, 1, 0, 7, 56, 57, 34, 52, 21, 2,
]


def _get_mixin_key(orig: str) -> str:
    """按 B站 WBI 置换表混合 img_key+sub_key，取前 32 位。"""
    return "".join(orig[i] for i in _MIXIN_KEY_ENC_TAB if i < len(orig))[:32]


_BILI_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.bilibili.com",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


@router.get("/bilibili-videos")
async def bilibili_videos(
    keyword: str = Query(..., min_length=1, max_length=100, description="知识点名称"),
    limit: int = Query(8, ge=1, le=20, description="返回条数"),
):
    """搜索B站相关教学视频，返回标题/UP主/播放量/封面/链接。"""
    try:
        async with httpx.AsyncClient(timeout=15, headers=_BILI_HEADERS) as client:
            # 1) 获取 WBI img_key + sub_key
            img_key = sub_key = ""
            try:
                nav = await client.get("https://api.bilibili.com/x/web-interface/nav")
                wbi = nav.json().get("data", {}).get("wbi_img", {})
                img_key = (wbi.get("img_url") or "").rsplit("/", 1)[-1].split(".")[0]
                sub_key = (wbi.get("sub_url") or "").rsplit("/", 1)[-1].split(".")[0]
            except Exception:
                pass

            # 2) 构造搜索参数 + WBI 签名
            #    自动追加「讲解」后缀，让结果偏向教学类视频而非娱乐内容
            search_keyword = f"{keyword} 讲解"
            params: dict = {
                "search_type": "video",
                "keyword": search_keyword,
                "page": 1,
                "page_size": min(limit, 20),
                "order": "totalrank",       # 综合排序，教学类优先
                "duration": 0,               # 不限时长
                "tids_1": "",                # 不限分区
                "wts": int(time.time()),
            }
            if img_key and sub_key:
                mixin = _get_mixin_key(img_key + sub_key)
                query_str = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
                params["w_rid"] = hashlib.md5((query_str + mixin).encode()).hexdigest()

            # 3) 发起搜索
            resp = await client.get(
                "https://api.bilibili.com/x/web-interface/wbi/search/type",
                params=params,
            )
            data = resp.json()

        if data.get("code") == 0:
            results = data.get("data", {}).get("result", [])

            def _parse_duration(s: str) -> int:
                """把 '3:7' / '405:43' 解析为秒数"""
                parts = s.split(":")
                try:
                    if len(parts) == 2:
                        return int(parts[0]) * 60 + int(parts[1])
                    if len(parts) == 3:
                        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                except ValueError:
                    pass
                return 0

            # 过滤：时长 ≥ 2 分钟 或 时长未知（排除短视频娱乐内容）
            # 同时过滤标题含娱乐关键词的结果
            _BLOCK_WORDS = ("过审", "整活", "搞笑", "鬼畜", "挑战", "摸", "自摸")
            filtered = [
                v for v in results
                if (not v.get("duration") or _parse_duration(v.get("duration", "")) >= 120)
                and not any(w in re.sub(r"<[^>]+>", "", v.get("title", "")) for w in _BLOCK_WORDS)
            ]
            # 仅在完全过滤干净时回退到原始结果
            if not filtered:
                filtered = results

            videos = []
            for v in filtered[:limit]:
                # 去掉 <em class="keyword"> 高亮标签
                title = re.sub(r"<[^>]+>", "", v.get("title", ""))
                pic = v.get("pic", "")
                if pic.startswith("//"):
                    pic = "https:" + pic
                bvid = v.get("bvid", "")
                videos.append({
                    "bvid": bvid,
                    "title": title,
                    "author": v.get("author", ""),
                    "play": v.get("play", 0),
                    "danmaku": v.get("video_review", 0),
                    "favorites": v.get("favorites", 0),
                    "pic": pic,
                    "duration": v.get("duration", ""),
                    "url": f"https://www.bilibili.com/video/{bvid}",
                })
            return {"videos": videos, "ok": True, "keyword": keyword}
        else:
            # WBI 失败 → 回退：直接构造搜索页 URL
            return {
                "videos": [],
                "ok": False,
                "error": data.get("message", "B站搜索接口返回异常"),
                "fallback_url": f"https://search.bilibili.com/all?keyword={quote(keyword)}",
            }
    except Exception as e:
        return {
            "videos": [],
            "ok": False,
            "error": f"请求B站失败：{e}",
            "fallback_url": f"https://search.bilibili.com/all?keyword={quote(keyword)}",
        }
