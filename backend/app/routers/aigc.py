"""AIGC 能力路由：
- POST /api/aigc/generate     围绕课程主题，调用大模型直接生成知识图谱并入库
- POST /api/aigc/resources/suggest  针对单个知识点，调用大模型生成学习资源建议
- GET  /api/aigc/bilibili-videos    搜索B站相关教学视频
"""
from __future__ import annotations

import hashlib
import re
import time
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
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


def _upsert_graph_result(db: Session, result, document_id=None) -> None:
    """把 ExtractResult 写入 KGNode/KGRelation（按 id upsert）。"""
    node_map: dict[str, models.KGNode] = {}
    for n in result.nodes:
        row = db.query(models.KGNode).filter(models.KGNode.id == n["id"]).first()
        if row:
            row.name = n["name"]
            row.category = n["category"]
            row.description = n["description"]
            row.difficulty = float(n.get("difficulty") or 3.0)
        else:
            row = models.KGNode(
                id=n["id"], name=n["name"], category=n["category"],
                description=n["description"], difficulty=float(n.get("difficulty") or 3.0),
                document_id=document_id,
            )
            db.add(row)
        node_map[row.id] = row
    db.flush()

    for r in result.relations:
        if r["source"] not in node_map or r["target"] not in node_map:
            continue
        row = db.query(models.KGRelation).filter(models.KGRelation.id == r["id"]).first()
        if row:
            row.source = r["source"]
            row.target = r["target"]
            row.type = r["type"]
            row.label = r["label"]
        else:
            db.add(models.KGRelation(
                id=r["id"], source=r["source"], target=r["target"],
                type=r["type"], label=r["label"], document_id=document_id,
            ))
    db.commit()


@router.post("/generate")
async def generate_graph(payload: GenerateRequest, db: Session = Depends(get_db)):
    """围绕课程主题，调用大模型生成知识图谱，写入数据库并返回。"""
    result = await generate_graph_by_topic(payload.topic, model=payload.model)

    if result.nodes:
        # 清空旧图谱，保证 AIGC 生成结果独立可见（也可改为合并，这里以「新生成」语义为主）
        _upsert_graph_result(db, result, document_id=None)

    return {
        "topic": payload.topic,
        "nodes": result.nodes,
        "relations": result.relations,
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
