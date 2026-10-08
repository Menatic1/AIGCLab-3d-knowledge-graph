"""Course creation, membership, and course metadata endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, get_current_user_optional
from ..database import get_db
from ..permissions import require_authenticated, require_course_access

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _course_out(course: models.Course, role: str | None = None) -> schemas.CourseOut:
    return schemas.CourseOut(
        id=course.id,
        owner_id=course.owner_id,
        name=course.name,
        description=course.description,
        role=role,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


@router.get("", response_model=list[schemas.CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    user_id = current_user.id if current_user else "default"
    courses = db.query(models.Course).order_by(models.Course.created_at.desc()).all()
    result = []
    for course in courses:
        role = "owner" if course.owner_id == user_id else None
        if role is None:
            member = (
                db.query(models.CourseMember)
                .filter(
                    models.CourseMember.course_id == course.id,
                    models.CourseMember.user_id == user_id,
                )
                .first()
            )
            role = member.role if member else None
        if role:
            result.append(_course_out(course, role))
    return result


@router.post("", response_model=schemas.CourseOut, status_code=201)
def create_course(
    payload: schemas.CourseCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = require_authenticated(current_user)
    if user.role != "teacher":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="只有教师可以创建课程")
    course = models.Course(owner_id=user.id, name=payload.name, description=payload.description)
    db.add(course)
    db.flush()
    db.add(models.CourseMember(course_id=course.id, user_id=user.id, role="owner"))
    db.commit()
    db.refresh(course)
    return _course_out(course, "owner")


@router.get("/{course_id}", response_model=schemas.CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user)
    return _course_out(ctx.course, ctx.role)


@router.put("/{course_id}", response_model=schemas.CourseOut)
def update_course(
    course_id: int,
    payload: schemas.CourseUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "teacher")
    if payload.name is not None:
        ctx.course.name = payload.name
    if payload.description is not None:
        ctx.course.description = payload.description
    db.commit()
    db.refresh(ctx.course)
    return _course_out(ctx.course, ctx.role)


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "owner")
    # SQLite deployments may have foreign-key enforcement disabled, so remove
    # course-scoped records explicitly instead of relying on ON DELETE.
    document_ids = [row[0] for row in db.query(models.Document.id).filter(models.Document.course_id == course_id).all()]
    db.query(models.ExtractionTask).filter(models.ExtractionTask.course_id == course_id).delete(synchronize_session=False)
    db.query(models.QARecord).filter(models.QARecord.course_id == course_id).delete(synchronize_session=False)
    db.query(models.UserProgress).filter(models.UserProgress.course_id == course_id).delete(synchronize_session=False)
    db.query(models.KGRelation).filter(models.KGRelation.course_id == course_id).delete(synchronize_session=False)
    db.query(models.KGNode).filter(models.KGNode.course_id == course_id).delete(synchronize_session=False)
    if document_ids:
        db.query(models.Document).filter(models.Document.id.in_(document_ids)).delete(synchronize_session=False)
    db.query(models.CourseMember).filter(models.CourseMember.course_id == course_id).delete(synchronize_session=False)
    db.delete(ctx.course)
    db.commit()
    return {"ok": True}


@router.post("/{course_id}/join", response_model=schemas.CourseJoinOut)
def join_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = require_authenticated(current_user)
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="课程不存在")
    if course.owner_id == user.id:
        return schemas.CourseJoinOut(course=_course_out(course, "owner"), already_member=True)
    member = (
        db.query(models.CourseMember)
        .filter(
            models.CourseMember.course_id == course_id,
            models.CourseMember.user_id == user.id,
        )
        .first()
    )
    if member:
        return schemas.CourseJoinOut(course=_course_out(course, member.role), already_member=True)
    db.add(models.CourseMember(course_id=course_id, user_id=user.id, role="student"))
    db.commit()
    return schemas.CourseJoinOut(course=_course_out(course, "student"), already_member=False)
