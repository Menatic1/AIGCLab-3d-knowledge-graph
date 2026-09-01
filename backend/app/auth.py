"""认证工具：密码哈希 + JWT-like Token（纯标准库实现，零额外依赖）。"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from typing import Any

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User

# 从环境变量读取密钥，fallback 到固定值（开发环境）
_SECRET_KEY = os.environ.get("JWT_SECRET", "aigc-knowledge-graph-2026-secret-key")
_TOKEN_TTL = 7 * 24 * 3600  # 7 天过期


# ── 密码哈希 ──
def hash_password(password: str) -> tuple[str, str]:
    """返回 (hashed_password_hex, salt_hex)。"""
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return hashed.hex(), salt.hex()


def verify_password(password: str, hashed_hex: str, salt_hex: str) -> bool:
    salt = bytes.fromhex(salt_hex)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return hmac.compare_digest(hashed.hex(), hashed_hex)


# ── Token（JWT-like，纯标准库）──
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def create_token(user_id: str, username: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": int(time.time()) + _TOKEN_TTL,
    }
    h = _b64(json.dumps(header, separators=(",", ":")).encode())
    p = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(_SECRET_KEY.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    s = _b64(sig)
    return f"{h}.{p}.{s}"


def decode_token(token: str) -> dict[str, Any] | None:
    """验证并解码 token，返回 payload 或 None。"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h, p, s = parts
        expected_sig = hmac.new(_SECRET_KEY.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64(expected_sig), s):
            return None
        payload = json.loads(_b64_decode(p))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── FastAPI 依赖 ──
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    """从 Authorization: Bearer <token> 提取当前用户。"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供认证 Token")
    token = authorization[7:]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


def get_current_user_optional(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User | None:
    """可选认证：有 token 就验证，没有就返回 None（用于公开接口）。"""
    if not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    payload = decode_token(token)
    if not payload:
        return None
    return db.query(User).filter(User.id == payload["user_id"]).first()
