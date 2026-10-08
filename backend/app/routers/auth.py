"""认证路由：注册 / 登录 / 获取当前用户信息。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..auth import get_db
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=32, description="用户名")
    password: str = Field(..., min_length=6, max_length=64, description="密码")
    role: Literal["teacher", "student"] = "student"


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=32)
    password: str = Field(..., min_length=6, max_length=64)


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """注册新用户。"""
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="用户名已存在")
    import uuid as _uuid
    user_id = str(_uuid.uuid4()).replace("-", "")[:20]
    hashed, salt = hash_password(payload.password)
    user = User(id=user_id, username=payload.username, hashed_password=hashed, salt=salt, role=payload.role)
    db.add(user)
    db.commit()
    token = create_token(user.id, user.username)
    return {
        "token": token,
        "user": {"id": user.id, "username": user.username, "role": user.role},
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """登录，返回 JWT token。"""
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password, user.salt):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_token(user.id, user.username)
    return {
        "token": token,
        "user": {"id": user.id, "username": user.username, "role": user.role},
    }


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """获取当前登录用户信息。"""
    return {"id": user.id, "username": user.username, "role": user.role}
