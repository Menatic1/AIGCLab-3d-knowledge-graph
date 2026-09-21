"""Shared course authorization helpers used by all course-scoped routers."""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Course, CourseMember, User


_ROLE_RANK = {"student": 1, "teacher": 2, "owner": 3}


@dataclass(frozen=True)
class CourseContext:
    course: Course
    user_id: str
    role: str


def effective_user_id(current_user: User | None) -> str:
    return current_user.id if current_user else "default"


def _course_role(db: Session, course: Course, user_id: str) -> str | None:
    if course.owner_id == user_id:
        return "owner"
    member = (
        db.query(CourseMember)
        .filter(CourseMember.course_id == course.id, CourseMember.user_id == user_id)
        .first()
    )
    return member.role if member else None


def require_course_access(
    db: Session,
    course_id: int,
    current_user: User | None,
    minimum_role: str = "student",
) -> CourseContext:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")

    user_id = effective_user_id(current_user)
    role = _course_role(db, course, user_id)
    if role is None:
        raise HTTPException(status_code=403, detail="无权访问该课程")
    if _ROLE_RANK.get(role, 0) < _ROLE_RANK.get(minimum_role, 1):
        raise HTTPException(status_code=403, detail="权限不足")
    return CourseContext(course=course, user_id=user_id, role=role)


def require_authenticated(current_user: User | None) -> User:
    if current_user is None:
        raise HTTPException(status_code=401, detail="未提供认证 Token")
    return current_user
