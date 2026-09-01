"""AI 实时互动讲题老师路由。

核心闭环：
1. 创建会话：题目识别(文字/图片 vision) → 知识点定位 → 前置链生成(图遍历) → 教学计划(LLM)
2. SSE 流式播放每步板书指令(逐条推送实现手写动画节奏) + 口播 + 验证提问
3. 打断提问(实时对话) / 懂了-不懂反馈(动态策略 + 掌握度更新)
4. 变式练习生成 + 自动批改 + 错题讲解
5. 掌握度回流：轻量 BKT 更新 UserProgress，记录 MasteryEvent

数据按用户隔离：所有会话绑定 current_user.id。
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..llm_client import (
    recognize_problem, locate_knowledge_points, build_teaching_plan,
    tutor_dialogue, generate_exercises, grade_exercise,
)
from ..models import User

router = APIRouter(prefix="/api/tutor", tags=["tutor"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 前置关系类型（兼容中英文 + 示例数据的反向约定）
PREREQ_TYPES = {"先修", "prerequisite", "前置", "先修关系"}


# ==================== 请求/响应模型 ====================
class InterruptRequest(BaseModel):
    question: str
    step_index: int | None = None


class FeedbackRequest(BaseModel):
    step_index: int
    understood: bool
    answer: str | None = None  # 验证提问的用户回答


class ExerciseSubmitRequest(BaseModel):
    user_answer: str


# ==================== 工具：图遍历前置链 ====================
def _build_prereq_chain(db: Session, user_id: str, node_ids: list[str], max_depth: int = 4) -> list[dict]:
    """从命中知识点出发，沿"先修/prerequisite"关系向上回溯，收集前置知识点链。
    双向兼容：无论边的方向，把"另一端"都作为候选前置，再结合掌握度过滤掉已掌握的。
    返回从基础到应用的有序列表 [{id,name,category,description,difficulty,mastery}]。"""
    if not node_ids:
        return []

    all_nodes = {n.id: n for n in db.query(models.KGNode).filter(models.KGNode.user_id == user_id).all()}
    all_rels = db.query(models.KGRelation).filter(models.KGRelation.user_id == user_id).all()

    # 邻接表：节点 -> 候选前置节点 id 列表（双向）
    adj: dict[str, list[str]] = {}
    for r in all_rels:
        if (r.type or "").strip() not in PREREQ_TYPES:
            continue
        adj.setdefault(r.source, []).append(r.target)
        adj.setdefault(r.target, []).append(r.source)

    # 掌握度
    progress = {p.node_id: p.score for p in
                 db.query(models.UserProgress).filter(models.UserProgress.user_id == user_id).all()}

    # BFS 回溯
    visited: set[str] = set()
    ordered: list[str] = []  # 从基础到应用（反向 BFS 顺序）
    queue = list(node_ids)
    # 先把命中节点标记为"应用层"
    for nid in node_ids:
        if nid not in visited:
            visited.add(nid)
            ordered.append(nid)

    # 逐层向上找前置
    frontier = list(node_ids)
    for _ in range(max_depth):
        nxt: list[str] = []
        for nid in frontier:
            for pre in adj.get(nid, []):
                if pre in visited or pre not in all_nodes:
                    continue
                visited.add(pre)
                ordered.append(pre)
                nxt.append(pre)
        frontier = nxt
        if not frontier:
            break

    # ordered 目前是 [应用层..., 基础层...]，反转成 [基础..., 应用]
    ordered = list(reversed(ordered))

    # 过滤已掌握(score>=80)的前置，仅保留薄弱环节（但命中节点保留）
    result: list[dict] = []
    for nid in ordered:
        n = all_nodes.get(nid)
        if not n:
            continue
        score = progress.get(nid, 0.0)
        # 已掌握且非命中节点 → 跳过冗余补讲
        if score >= 80 and nid not in node_ids:
            continue
        result.append({
            "id": n.id, "name": n.name, "category": n.category,
            "description": n.description or "", "difficulty": float(n.difficulty or 3.0),
            "mastery": score,
        })
    return result


def _mastery_map(db: Session, user_id: str, node_ids: list[str]) -> dict:
    rows = (db.query(models.UserProgress)
            .filter(models.UserProgress.user_id == user_id,
                    models.UserProgress.node_id.in_(node_ids if node_ids else ["__none__"]))
            .all())
    return {r.node_id: r.score for r in rows}


# ==================== 掌握度更新（轻量 BKT）====================
# 事件 → 增量
_DELTA = {
    "understood": 15.0,
    "unclear": -8.0,
    "exercise_correct": 12.0,
    "exercise_wrong": -10.0,
    "question_wrong": -5.0,
}


def _apply_mastery(db: Session, user_id: str, session_id: str, node_id: str, event_type: str) -> float:
    """应用一次掌握度更新：记录事件 + 更新 UserProgress.score，返回新 score。"""
    delta = _DELTA.get(event_type, 0.0)
    row = (db.query(models.UserProgress)
           .filter(models.UserProgress.user_id == user_id, models.UserProgress.node_id == node_id)
           .first())
    old = row.score if row else 0.0
    new = max(0.0, min(100.0, old + delta))
    if row:
        row.score = new
        row.mastered = new >= 80.0
    else:
        # 节点必须存在
        if db.query(models.KGNode).filter(models.KGNode.id == node_id).first():
            db.add(models.UserProgress(user_id=user_id, node_id=node_id, mastered=new >= 80.0, score=new))
    db.add(models.MasteryEvent(
        user_id=user_id, session_id=session_id, node_id=node_id,
        event_type=event_type, delta=delta, new_score=new,
    ))
    db.commit()
    return new


def _session_to_dict(s: models.TutorSession, *, with_steps_detail: bool = False) -> dict:
    """序列化会话。with_steps_detail=False 时 step 只返回概要（避免剧透板书内容）。"""
    located = json.loads(s.located_node_ids) if s.located_node_ids else []
    prereq = json.loads(s.prereq_chain) if s.prereq_chain else []
    plan = json.loads(s.teaching_plan) if s.teaching_plan else {}
    steps = []
    for st in sorted(s.steps, key=lambda x: x.index):
        item = {
            "index": st.index, "kind": st.kind, "node_id": st.node_id,
            "node_name": st.node_name, "status": st.status,
            "verify_question": st.verify_question if with_steps_detail or st.status != "pending" else None,
        }
        if with_steps_detail or st.status in ("understood", "unclear", "skipped"):
            item["board"] = json.loads(st.board) if st.board else []
            item["narration"] = st.narration
            item["verify_answer"] = st.verify_answer
        steps.append(item)
    return {
        "id": s.id, "status": s.status, "current_step": s.current_step,
        "problem": {
            "text": s.problem_text, "latex": s.problem_latex,
            "image_path": s.problem_image_path,
        },
        "located_node_ids": located,
        "prereq_chain": prereq,
        "strategy": plan.get("strategy", ""),
        "used_llm": plan.get("used_llm", False),
        "steps": steps,
        "steps_count": len(s.steps),
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ==================== 1. 创建会话 ====================
@router.post("/sessions")
async def create_session(
    text: str | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """创建讲题会话：题目识别 → 知识点定位 → 前置链 → 教学计划。"""
    if not text and not image:
        raise HTTPException(400, "请提供题目文本或题目图片")

    image_b64 = None
    media_type = "image/png"
    saved_path = None
    if image:
        raw = await image.read()
        if not raw:
            raise HTTPException(400, "图片为空")
        media_type = image.content_type or "image/png"
        ext = ".png"
        for ct, e in [("image/jpeg", ".jpg"), ("image/png", ".png"), ("image/webp", ".webp")]:
            if media_type == ct:
                ext = e
                break
        fname = f"tutor_{uuid.uuid4().hex[:12]}{ext}"
        saved_path = os.path.join(UPLOAD_DIR, fname)
        with open(saved_path, "wb") as f:
            f.write(raw)
        image_b64 = base64.b64encode(raw).decode("ascii")

    # 1) 题目识别（图片走 vision，文字直接识别/结构化）
    problem = await recognize_problem(text=text, image_b64=image_b64, image_media_type=media_type)
    if not problem.get("text"):
        problem["text"] = text or ""

    # 2) 获取用户图谱节点
    nodes_orm = db.query(models.KGNode).filter(models.KGNode.user_id == user.id).all()
    if not nodes_orm:
        raise HTTPException(400, "你的知识图谱为空，请先上传课程文档或生成图谱后再使用讲题老师")
    nodes_dicts = [{"id": n.id, "name": n.name, "category": n.category, "description": n.description or ""}
                    for n in nodes_orm]

    # 3) 知识点定位
    located_ids, reason = await locate_knowledge_points(problem.get("text", ""), nodes_dicts)
    located_nodes = [n for n in nodes_dicts if n["id"] in located_ids]

    # 4) 前置链
    prereq_chain = _build_prereq_chain(db, user.id, located_ids)
    mastery = _mastery_map(db, user.id, located_ids + [p["id"] for p in prereq_chain])

    # 5) 教学计划
    plan = await build_teaching_plan(problem, located_nodes, prereq_chain, mastery)

    # 6) 落库
    session_id = uuid.uuid4().hex[:16]
    session = models.TutorSession(
        id=session_id, user_id=user.id,
        problem_text=problem.get("text", ""),
        problem_latex=problem.get("latex", ""),
        problem_image_path=saved_path,
        located_node_ids=json.dumps(located_ids, ensure_ascii=False),
        prereq_chain=json.dumps(prereq_chain, ensure_ascii=False),
        teaching_plan=json.dumps(plan, ensure_ascii=False),
        status="teaching", current_step=0,
    )
    db.add(session)
    db.flush()

    steps_data = plan.get("steps") or []
    for i, st in enumerate(steps_data):
        db.add(models.TutorStep(
            session_id=session_id, index=i,
            kind=st.get("kind", "solve"),
            node_id=next((n["id"] for n in located_nodes if n["name"] == st.get("node_name")), None),
            node_name=st.get("node_name", ""),
            board=json.dumps(st.get("board") or [], ensure_ascii=False),
            narration=st.get("narration", ""),
            verify_question=st.get("verify_question", ""),
            verify_answer=st.get("verify_answer", ""),
            status="pending",
        ))
    db.commit()

    return _session_to_dict(db.query(models.TutorSession).filter(models.TutorSession.id == session_id).first(),
                            with_steps_detail=False)


# ==================== 2. 获取会话详情 ====================
@router.get("/sessions/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(models.TutorSession).filter(models.TutorSession.id == session_id,
                                             models.TutorSession.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "会话不存在")
    return _session_to_dict(s, with_steps_detail=False)


# ==================== 3. SSE 流式播放某步板书 ====================
@router.get("/sessions/{session_id}/steps/{step_index}/play")
async def play_step(
    session_id: str, step_index: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """SSE 流式推送该 step 的板书指令逐条 + 口播 + 验证提问。
    每条板书指令一个 event，实现"边写边讲"的手写动画节奏。"""
    s = db.query(models.TutorSession).filter(models.TutorSession.id == session_id,
                                             models.TutorSession.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "会话不存在")
    step = next((st for st in s.steps if st.index == step_index), None)
    if not step:
        raise HTTPException(404, f"步骤 {step_index} 不存在")

    # 标记当前步为 teaching
    s.current_step = step_index
    step.status = "teaching"
    db.commit()

    board = json.loads(step.board) if step.board else []

    async def event_gen():
        # 起始事件
        yield f"event: start\ndata: {json.dumps({'step_index': step_index, 'kind': step.kind, 'node_name': step.node_name}, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.15)
        # 逐条板书指令
        for i, cmd in enumerate(board):
            payload = {"index": i, **cmd}
            yield f"event: board\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.35)  # 手写节奏
        # 口播
        yield f"event: narration\ndata: {json.dumps({'text': step.narration or ''}, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.2)
        # 验证提问
        if step.verify_question:
            yield f"event: verify\ndata: {json.dumps({'question': step.verify_question, 'answer': step.verify_answer or ''}, ensure_ascii=False)}\n\n"
        # 结束
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ==================== 4. 打断提问 ====================
@router.post("/sessions/{session_id}/interrupt")
async def interrupt(
    session_id: str, payload: InterruptRequest,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    s = db.query(models.TutorSession).filter(models.TutorSession.id == session_id,
                                             models.TutorSession.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "会话不存在")
    idx = payload.step_index if payload.step_index is not None else s.current_step
    step = next((st for st in s.steps if st.index == idx), None)
    answer, used_llm = await tutor_dialogue(
        payload.question, idx,
        step.node_name if step else "",
        step.narration if step else "",
        s.problem_text or "",
    )
    # 打断提问本身若暴露不懂，轻量扣掌握度
    if step and step.node_id:
        _apply_mastery(db, user.id, session_id, step.node_id, "question_wrong")
    return {"answer": answer, "used_llm": used_llm, "step_index": idx}


# ==================== 5. 反馈：懂了/不懂 + 动态策略 ====================
@router.post("/sessions/{session_id}/feedback")
def feedback(
    session_id: str, payload: FeedbackRequest,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    s = db.query(models.TutorSession).filter(models.TutorSession.id == session_id,
                                             models.TutorSession.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "会话不存在")
    step = next((st for st in s.steps if st.index == payload.step_index), None)
    if not step:
        raise HTTPException(404, f"步骤 {payload.step_index} 不存在")

    # 验证提问答案判定（若有）
    verify_ok = True
    if step.verify_answer and payload.answer:
        verify_ok = payload.answer.strip().lower() in (step.verify_answer or "").strip().lower()

    if payload.understood and verify_ok:
        step.status = "understood"
        if step.node_id:
            _apply_mastery(db, user.id, session_id, step.node_id, "understood")
    else:
        step.status = "unclear"
        if step.node_id:
            _apply_mastery(db, user.id, session_id, step.node_id, "unclear")
    fb = json.loads(step.feedback) if step.feedback else {}
    fb["last"] = {"understood": payload.understood, "answer": payload.answer, "verify_ok": verify_ok}
    step.feedback = json.dumps(fb, ensure_ascii=False)
    db.commit()

    # 动态策略：连续不懂 → 建议插入更基础知识点（这里返回提示，实际插由前端/后续步处理）
    consecutive_unclear = 0
    for st in sorted(s.steps, key=lambda x: x.index):
        if st.index > payload.step_index:
            break
        if st.status == "unclear":
            consecutive_unclear += 1
        elif st.status == "understood":
            consecutive_unclear = 0
    suggestion = None
    if consecutive_unclear >= 2:
        suggestion = "连续2步未掌握，建议回退到更基础的知识点，或换用图示/举例方式讲解。"

    # 是否还有下一步
    next_step = payload.step_index + 1
    has_next = any(st.index == next_step for st in s.steps)
    if not has_next:
        s.status = "practicing"
        db.commit()

    return {
        "step_status": step.status, "verify_ok": verify_ok,
        "has_next": has_next, "next_step": next_step if has_next else None,
        "suggestion": suggestion,
        "session_status": s.status,
    }


# ==================== 6. 变式练习生成 ====================
@router.post("/sessions/{session_id}/exercises")
async def gen_exercises(
    session_id: str,
    node_id: str | None = Query(None, description="指定知识点 id；不填则用命中知识点"),
    n: int = Query(3, ge=1, le=5),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    s = db.query(models.TutorSession).filter(models.TutorSession.id == session_id,
                                             models.TutorSession.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "会话不存在")

    # 选定知识点
    located = json.loads(s.located_node_ids) if s.located_node_ids else []
    target_id = node_id or (located[0] if located else None)
    if not target_id:
        raise HTTPException(400, "无可用于出题的知识点")
    node = db.query(models.KGNode).filter(models.KGNode.id == target_id).first()
    if not node:
        raise HTTPException(400, "知识点不存在")

    items = await generate_exercises(
        node.name, node.category, node.description or "", int(node.difficulty or 3), n,
    )
    if not items:
        raise HTTPException(500, "练习生成失败，请检查 LLM 配置")

    created = []
    for it in items:
        ex = models.TutorExercise(
            session_id=session_id, node_id=target_id,
            question=it.get("question", ""),
            choices=json.dumps(it.get("choices"), ensure_ascii=False) if it.get("choices") else None,
            answer=str(it.get("answer", "")),
            explanation=it.get("explanation", ""),
            difficulty=int(it.get("difficulty", 3)),
        )
        db.add(ex)
        db.flush()
        created.append({
            "id": ex.id, "node_id": target_id, "question": ex.question,
            "choices": json.loads(ex.choices) if ex.choices else None,
            "answer": ex.answer, "explanation": ex.explanation, "difficulty": ex.difficulty,
        })
    db.commit()
    return {"items": created, "node_name": node.name}


# ==================== 7. 练习提交批改 ====================
@router.post("/sessions/{session_id}/exercises/{exercise_id}/submit")
async def submit_exercise(
    session_id: str, exercise_id: int, payload: ExerciseSubmitRequest,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    ex = db.query(models.TutorExercise).filter(
        models.TutorExercise.id == exercise_id,
        models.TutorExercise.session_id == session_id,
    ).first()
    if not ex:
        raise HTTPException(404, "练习不存在")
    # 校验会话归属
    s = db.query(models.TutorSession).filter(models.TutorSession.id == session_id,
                                             models.TutorSession.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "会话不存在")

    result = await grade_exercise(ex.question, ex.answer, payload.user_answer)
    ex.user_answer = payload.user_answer
    ex.is_correct = bool(result.get("is_correct"))
    db.commit()

    # 掌握度更新
    if ex.node_id:
        _apply_mastery(db, user.id, session_id, ex.node_id,
                       "exercise_correct" if ex.is_correct else "exercise_wrong")

    return {
        "is_correct": ex.is_correct,
        "explanation": result.get("explanation", ""),
        "standard_answer": ex.answer,
        "used_llm": result.get("used_llm", False),
    }


# ==================== 8. 会话列表（我的讲题历史）====================
@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (db.query(models.TutorSession)
            .filter(models.TutorSession.user_id == user.id)
            .order_by(models.TutorSession.created_at.desc())
            .limit(50).all())
    return {"items": [
        {"id": s.id, "status": s.status, "current_step": s.current_step,
         "problem_text": (s.problem_text or "")[:80],
         "steps_count": len(s.steps),
         "created_at": s.created_at.isoformat() if s.created_at else None}
        for s in rows
    ]}
