"""User profile endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


def _profile(user: models.User) -> schemas.UserProfileOut:
    return schemas.UserProfileOut(id=user.id, username=user.username, role=user.role)


@router.get("/{user_id}/profile", response_model=schemas.UserProfileOut)
def get_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.id != user_id and current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="无权查看该用户资料")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return _profile(user)


@router.put("/{user_id}/profile", response_model=schemas.UserProfileOut)
def update_profile(
    user_id: str,
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="只能修改自己的资料")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if payload.username is not None and payload.username != user.username:
        duplicate = db.query(models.User).filter(models.User.username == payload.username).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="用户名已存在")
        user.username = payload.username
    db.commit()
    db.refresh(user)
    return _profile(user)
