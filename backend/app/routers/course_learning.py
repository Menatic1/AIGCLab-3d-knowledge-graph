"""Course-scoped QA, progress, and learning-path endpoints."""
from __future__ import annotations

from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user_optional
from ..database import get_db
from ..llm_client import answer_question
from ..permissions import effective_user_id, require_course_access

router = APIRouter(tags=["course-learning"])


def _course_nodes(db: Session, course_id: int):
    return db.query(models.KGNode).filter(
        models.KGNode.course_id == course_id,
        models.KGNode.review_status != "discarded",
    ).all()


def _course_relations(db: Session, course_id: int):
    return db.query(models.KGRelation).filter(
        models.KGRelation.course_id == course_id,
        models.KGRelation.review_status != "discarded",
    ).all()


@router.post("/api/courses/{course_id}/qa/ask", response_model=schemas.QAAnswer)
async def course_ask(
    course_id: int,
    payload: schemas.QARequest,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user)
    nodes = _course_nodes(db, course_id)
    answer, related, used_llm = await answer_question(
        question=payload.question,
        all_nodes=nodes,
        use_llm=payload.use_llm,
    )
    record = models.QARecord(
        user_id=ctx.user_id,
        course_id=course_id,
        question=payload.question,
        answer=answer,
        context_nodes=",".join(n.id for n in related),
        used_llm=used_llm,
    )
    db.add(record)
    db.commit()
    return schemas.QAAnswer(
        answer=answer,
        related_nodes=[schemas.KGNodeOut.model_validate(n) for n in related],
        used_llm=used_llm,
    )


@router.get("/api/courses/{course_id}/qa/history")
def course_history(
    course_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user)
    query = db.query(models.QARecord).filter(models.QARecord.course_id == course_id)
    if ctx.role == "student":
        query = query.filter(models.QARecord.user_id == ctx.user_id)
    rows = query.order_by(models.QARecord.created_at.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "question": row.question,
            "answer": row.answer,
            "used_llm": row.used_llm,
            "related_node_ids": (row.context_nodes or "").split(",") if row.context_nodes else [],
            "created_at": row.created_at,
            "feedback_helpful": row.feedback_helpful,
            "feedback_comment": row.feedback_comment,
        }
        for row in rows
    ]


@router.post("/api/qa/{question_id}/feedback", response_model=schemas.QAFeedbackOut)
def qa_feedback(
    question_id: int,
    payload: schemas.QAFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    row = db.query(models.QARecord).filter(models.QARecord.id == question_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="问答记录不存在")
    if row.course_id is not None:
        ctx = require_course_access(db, row.course_id, current_user)
        if ctx.user_id != row.user_id and ctx.role not in {"owner", "teacher"}:
            raise HTTPException(status_code=403, detail="无权反馈该问答")
    elif effective_user_id(current_user) != row.user_id:
        raise HTTPException(status_code=403, detail="无权反馈该问答")
    row.feedback_helpful = payload.helpful
    row.feedback_comment = payload.comment
    db.commit()
    return schemas.QAFeedbackOut(question_id=row.id, helpful=row.feedback_helpful, comment=row.feedback_comment)


def _path_for_course(db: Session, course_id: int, user_id: str, payload: schemas.PathRecommendRequest):
    nodes = _course_nodes(db, course_id)
    if not nodes:
        raise HTTPException(status_code=400, detail="知识图谱为空，无法生成学习路径")
    node_map = {node.id: node for node in nodes}
    relations = _course_relations(db, course_id)
    prereq_types = {item.lower() for item in (payload.prerequisite_relation_types or ["先修"])}
    prereq_map: dict[str, list[str]] = defaultdict(list)
    out_edges: dict[str, list[str]] = defaultdict(list)
    in_degree = {node.id: 0 for node in nodes}
    for relation in relations:
        if (relation.type or "").lower() in prereq_types and relation.source in node_map and relation.target in node_map:
            prereq_map[relation.target].append(relation.source)
            out_edges[relation.source].append(relation.target)
            in_degree[relation.target] += 1
    queue = deque(sorted(node_id for node_id, degree in in_degree.items() if degree == 0))
    order = []
    while queue:
        node_id = queue.popleft()
        order.append(node_id)
        for target in sorted(out_edges[node_id]):
            in_degree[target] -= 1
            if in_degree[target] == 0:
                queue.append(target)
    order.extend(sorted(node_id for node_id in node_map if node_id not in order))
    if payload.start_node_id in node_map:
        order = order[order.index(payload.start_node_id):]
    if payload.target_node_id in node_map:
        order = order[: order.index(payload.target_node_id) + 1]
    order = order[: max(1, payload.max_items)]
    mastered = {
        row.node_id
        for row in db.query(models.UserProgress)
        .filter(models.UserProgress.course_id == course_id, models.UserProgress.user_id == user_id, models.UserProgress.mastered.is_(True))
        .all()
    }
    steps = []
    for node_id in order:
        node = node_map[node_id]
        prerequisites = [item for item in prereq_map[node_id] if item in node_map]
        missing = [item for item in prerequisites if item not in mastered]
        reason = "已掌握，可快速复习或跳过。" if node_id in mastered else (
            f"建议先掌握：{'、'.join(node_map[item].name for item in missing[:3])}。" if missing else "前置知识已满足，可以进入本知识点学习。"
        )
        steps.append(schemas.PathStep(
            node_id=node_id,
            name=node.name,
            category=node.category,
            description=node.description,
            mastered=node_id in mastered,
            prerequisites=prerequisites,
            reason=reason,
        ))
    return schemas.LearningPathOut(steps=steps, total_steps=len(steps), remaining=sum(not step.mastered for step in steps))


def _require_progress_target(db: Session, course_id: int, target_user_id: str, current_user: models.User | None):
    ctx = require_course_access(db, course_id, current_user)
    if target_user_id != ctx.user_id and ctx.role not in {"owner", "teacher"}:
        raise HTTPException(status_code=403, detail="教师才能查看其他学生的进度")
    return ctx


def _requested_user_id(requested: str | None, current_user: models.User | None) -> str:
    """Treat the legacy `default` payload value as the authenticated user."""
    if not requested or requested == "default":
        return effective_user_id(current_user)
    return requested


@router.get("/api/courses/{course_id}/learning-path/{user_id}/progress", response_model=schemas.ProgressOut)
def course_progress(
    course_id: int,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    user_id = _requested_user_id(user_id, current_user)
    _require_progress_target(db, course_id, user_id, current_user)
    nodes = _course_nodes(db, course_id)
    rows = db.query(models.UserProgress).filter(models.UserProgress.course_id == course_id, models.UserProgress.user_id == user_id).all()
    mastery = {row.node_id: (row.mastered, row.score) for row in rows}
    items = [schemas.ProgressItem(node_id=node.id, mastered=mastery.get(node.id, (False, 0.0))[0], score=mastery.get(node.id, (False, 0.0))[1]) for node in nodes]
    mastered = sum(item.mastered for item in items)
    return schemas.ProgressOut(user_id=user_id, total=len(items), mastered=mastered, mastery_rate=mastered / len(items) if items else 0.0, items=items)


@router.post("/api/courses/{course_id}/learning-path/progress", response_model=schemas.ProgressOut)
def update_course_progress(
    course_id: int,
    payload: schemas.ProgressUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    requested_user_id = _requested_user_id(payload.user_id, current_user)
    ctx = _require_progress_target(db, course_id, requested_user_id, current_user)
    user_id = requested_user_id
    node_ids = {node.id for node in _course_nodes(db, course_id)}
    for item in payload.items:
        if item.node_id not in node_ids:
            raise HTTPException(status_code=400, detail=f"节点 {item.node_id} 不存在")
        row = db.query(models.UserProgress).filter(models.UserProgress.course_id == course_id, models.UserProgress.user_id == user_id, models.UserProgress.node_id == item.node_id).first()
        if row:
            row.mastered, row.score = item.mastered, item.score
        else:
            db.add(models.UserProgress(course_id=course_id, user_id=user_id, node_id=item.node_id, mastered=item.mastered, score=item.score))
    db.commit()
    return course_progress(course_id, user_id, db, current_user)


@router.post("/api/courses/{course_id}/learning-path/recommend", response_model=schemas.LearningPathOut)
def course_recommend_path(
    course_id: int,
    payload: schemas.PathRecommendRequest,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    target_user_id = _requested_user_id(payload.user_id, current_user)
    _require_progress_target(db, course_id, target_user_id, current_user)
    return _path_for_course(db, course_id, target_user_id, payload)


@router.get("/api/courses/{course_id}/learning-path/visualize", response_model=schemas.KnowledgeGraphOut)
def visualize_path(
    course_id: int,
    user_id: str = Query("default"),
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    target_user_id = _requested_user_id(user_id, current_user)
    _require_progress_target(db, course_id, target_user_id, current_user)
    path = _path_for_course(db, course_id, target_user_id, schemas.PathRecommendRequest(user_id=target_user_id))
    ids = {step.node_id for step in path.steps}
    nodes = [node for node in _course_nodes(db, course_id) if node.id in ids]
    relations = [relation for relation in _course_relations(db, course_id) if relation.source in ids and relation.target in ids]
    return schemas.KnowledgeGraphOut(nodes=[schemas.KGNodeOut.model_validate(n) for n in nodes], relations=[schemas.KGRelationOut.model_validate(r) for r in relations])
