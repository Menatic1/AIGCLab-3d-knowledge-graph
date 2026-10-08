"""学习闭环接口：小测试、学习报告、偏好与动态推荐。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import get_current_user_optional
from ..database import get_db
from ..models import User
from ..services import learning

router = APIRouter(tags=["adaptive-learning"])


def _user_id(current_user: User | None) -> str:
    return current_user.id if current_user else "default"


@router.post("/api/quiz/submit", response_model=schemas.QuizAttemptOut)
def submit_quiz(
    payload: schemas.QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """提交一次知识点测试，并自动同步掌握状态。"""
    attempt, passed = learning.submit_quiz(db, _user_id(current_user), payload)
    return schemas.QuizAttemptOut(
        id=attempt.id,
        node_id=attempt.node_id,
        correct_count=attempt.correct_count,
        total_count=attempt.total_count,
        accuracy=attempt.accuracy,
        passed=passed,
        completed_at=attempt.completed_at,
    )


@router.get("/api/learning/report", response_model=schemas.LearningReportOut)
def get_learning_report(
    recent_limit: int = Query(default=8, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """返回学生掌握率、测试历史、平均正确率与薄弱知识点。"""
    return learning.learning_report(db, _user_id(current_user), recent_limit)


@router.get("/api/learning/recommendations", response_model=list[schemas.LearningRecommendationOut])
def get_recommendations(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """按前置知识、答题表现和学习偏好生成动态推荐。"""
    return learning.adaptive_recommendations(db, _user_id(current_user), limit)


@router.put("/api/learning/preference", response_model=schemas.LearningReportOut)
def set_learning_preference(
    payload: schemas.LearningPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """保存巩固优先、均衡推进或挑战进阶的学习偏好。"""
    user_id = _user_id(current_user)
    learning.update_preference(db, user_id, payload.preference)
    return learning.learning_report(db, user_id)
