"""自适应学习服务：测试、学习画像、报告与动态推荐。"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas

PASSING_ACCURACY = 67.0
PREFERENCES = {"reinforce", "balanced", "challenge"}
PREREQUISITE_TYPES = {"先修", "前置", "prerequisite", "依赖"}


def preference_for(db: Session, user_id: str) -> str:
    profile = db.get(models.LearningProfile, user_id)
    return profile.learning_preference if profile else "balanced"


def update_preference(db: Session, user_id: str, preference: str) -> str:
    if preference not in PREFERENCES:
        raise HTTPException(status_code=422, detail="不支持的学习偏好")
    profile = db.get(models.LearningProfile, user_id)
    if profile:
        profile.learning_preference = preference
        profile.updated_at = datetime.utcnow()
    else:
        db.add(models.LearningProfile(user_id=user_id, learning_preference=preference))
    db.commit()
    return preference


def submit_quiz(
    db: Session,
    user_id: str,
    payload: schemas.QuizSubmitRequest,
) -> tuple[models.QuizAttempt, bool]:
    node = db.get(models.KGNode, payload.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="知识点不存在")

    correct = min(payload.correct_count, payload.total_count)
    accuracy = round(correct / payload.total_count * 100, 2)
    passed = accuracy >= PASSING_ACCURACY
    attempt = models.QuizAttempt(
        user_id=user_id,
        node_id=node.id,
        correct_count=correct,
        total_count=payload.total_count,
        accuracy=accuracy,
    )
    db.add(attempt)

    progress = (
        db.query(models.UserProgress)
        .filter(models.UserProgress.user_id == user_id, models.UserProgress.node_id == node.id)
        .first()
    )
    if progress:
        progress.mastered = passed
        progress.score = accuracy
        progress.updated_at = datetime.utcnow()
    else:
        db.add(models.UserProgress(user_id=user_id, node_id=node.id, mastered=passed, score=accuracy))
    db.commit()
    db.refresh(attempt)
    return attempt, passed


def _latest_attempts(db: Session, user_id: str) -> dict[str, models.QuizAttempt]:
    attempts = (
        db.query(models.QuizAttempt)
        .filter(models.QuizAttempt.user_id == user_id)
        .order_by(models.QuizAttempt.completed_at.asc(), models.QuizAttempt.id.asc())
        .all()
    )
    return {attempt.node_id: attempt for attempt in attempts}


def adaptive_recommendations(
    db: Session,
    user_id: str,
    limit: int = 10,
) -> list[schemas.LearningRecommendationOut]:
    nodes = db.query(models.KGNode).all()
    if not nodes:
        return []
    node_by_id = {node.id: node for node in nodes}
    mastered_ids = {
        item.node_id
        for item in db.query(models.UserProgress)
        .filter(models.UserProgress.user_id == user_id, models.UserProgress.mastered.is_(True))
        .all()
    }
    prereq_map: dict[str, list[str]] = defaultdict(list)
    for relation in db.query(models.KGRelation).all():
        if (relation.type or "").lower() in PREREQUISITE_TYPES:
            prereq_map[relation.target].append(relation.source)

    latest_attempts = _latest_attempts(db, user_id)
    weak_node_ids = {node_id for node_id, attempt in latest_attempts.items() if attempt.accuracy < PASSING_ACCURACY}
    prerequisites_for_weak = {
        prerequisite
        for node_id in weak_node_ids
        for prerequisite in prereq_map.get(node_id, [])
        if prerequisite not in mastered_ids
    }
    preference = preference_for(db, user_id)
    candidates: list[tuple[float, models.KGNode, list[str], list[str], models.QuizAttempt | None, str]] = []

    for node in nodes:
        if node.id in mastered_ids:
            continue
        prerequisites = [item for item in prereq_map.get(node.id, []) if item in node_by_id]
        missing = [item for item in prerequisites if item not in mastered_ids]
        ready_ratio = len(prerequisites) and (len(prerequisites) - len(missing)) / len(prerequisites) or 0.5
        latest = latest_attempts.get(node.id)
        weak = node.id in weak_node_ids
        supports_weak = node.id in prerequisites_for_weak
        preference_boost = 0.0
        if preference == "reinforce":
            preference_boost = 30 if weak else 20 if supports_weak else 0
        elif preference == "challenge" and node.difficulty >= 4 and ready_ratio >= 0.5:
            preference_boost = 14

        score = ready_ratio * 55 + node.difficulty * 6 + preference_boost + (12 if weak else 0)
        if weak:
            reason = f"上次测试正确率 {latest.accuracy:.0f}% ，建议优先巩固"
        elif supports_weak:
            reason = "是薄弱知识点的前置基础，建议先补齐"
        elif preference == "challenge" and node.difficulty >= 4:
            reason = "符合挑战进阶偏好，且属于重点知识"
        elif not missing:
            reason = "前置知识已满足，可以开始学习"
        else:
            reason = f"已满足 {len(prerequisites) - len(missing)}/{len(prerequisites)} 个前置知识"
        candidates.append((score, node, prerequisites, missing, latest, reason))

    candidates.sort(key=lambda item: (-item[0], len(item[3]), -item[1].difficulty, item[1].name))
    return [
        schemas.LearningRecommendationOut(
            node_id=node.id,
            name=node.name,
            category=node.category,
            description=node.description,
            importance=node.difficulty,
            priority=index + 1,
            prerequisites=prerequisites,
            missing_prerequisites=missing,
            latest_accuracy=latest.accuracy if latest else None,
            reason=reason,
        )
        for index, (_, node, prerequisites, missing, latest, reason) in enumerate(candidates[:max(1, min(limit, 50))])
    ]


def learning_report(db: Session, user_id: str, recent_limit: int = 8) -> schemas.LearningReportOut:
    total_nodes = db.query(models.KGNode).count()
    progress_rows = db.query(models.UserProgress).filter(models.UserProgress.user_id == user_id).all()
    mastered_node_ids = [item.node_id for item in progress_rows if item.mastered]
    mastered_count = len(mastered_node_ids)
    attempts = (
        db.query(models.QuizAttempt)
        .filter(models.QuizAttempt.user_id == user_id)
        .order_by(models.QuizAttempt.completed_at.desc(), models.QuizAttempt.id.desc())
        .all()
    )
    latest = _latest_attempts(db, user_id)
    recent = attempts[:max(1, min(recent_limit, 50))]
    average_accuracy = round(sum(item.accuracy for item in attempts) / len(attempts), 2) if attempts else None
    return schemas.LearningReportOut(
        user_id=user_id,
        learning_preference=preference_for(db, user_id),
        total_nodes=total_nodes,
        mastered_nodes=mastered_count,
        mastery_rate=round(mastered_count / total_nodes * 100, 2) if total_nodes else 0.0,
        mastered_node_ids=mastered_node_ids,
        quiz_count=len(attempts),
        average_accuracy=average_accuracy,
        weak_node_ids=[node_id for node_id, attempt in latest.items() if attempt.accuracy < PASSING_ACCURACY],
        recent_attempts=[
            schemas.QuizAttemptOut(
                id=item.id,
                node_id=item.node_id,
                correct_count=item.correct_count,
                total_count=item.total_count,
                accuracy=item.accuracy,
                passed=item.accuracy >= PASSING_ACCURACY,
                completed_at=item.completed_at,
            )
            for item in recent
        ],
    )
