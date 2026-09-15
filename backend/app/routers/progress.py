"""学习进度 CRUD。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user_optional
from ..models import User

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=schemas.ProgressOut)
def get_progress(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else "default"
    all_nodes = db.query(models.KGNode).all()
    progress_rows = (
        db.query(models.UserProgress)
        .filter(models.UserProgress.user_id == user_id)
        .all()
    )
    mastery = {p.node_id: (p.mastered, p.score) for p in progress_rows}

    items = []
    mastered_cnt = 0
    for n in all_nodes:
        m, s = mastery.get(n.id, (False, 0.0))
        if m:
            mastered_cnt += 1
        items.append(schemas.ProgressItem(node_id=n.id, mastered=m, score=s))

    total = len(all_nodes)
    rate = (mastered_cnt / total) if total else 0.0
    return schemas.ProgressOut(
        user_id=user_id,
        total=total,
        mastered=mastered_cnt,
        mastery_rate=rate,
        items=items,
    )


@router.put("", response_model=schemas.ProgressOut)
def update_progress(
    payload: schemas.ProgressUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else (payload.user_id or "default")
    for it in payload.items:
        row = (
            db.query(models.UserProgress)
            .filter(models.UserProgress.user_id == user_id, models.UserProgress.node_id == it.node_id)
            .first()
        )
        if row:
            row.mastered = it.mastered
            row.score = it.score
        else:
            if not db.query(models.KGNode).filter(models.KGNode.id == it.node_id).first():
                raise HTTPException(400, f"节点 {it.node_id} 不存在")
            db.add(models.UserProgress(
                user_id=user_id, node_id=it.node_id, mastered=it.mastered, score=it.score,
            ))
    db.commit()
    return get_progress(db=db, current_user=current_user)
