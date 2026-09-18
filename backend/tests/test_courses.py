from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from main import app
from app.models import Course, CourseMember
from app.permissions import require_course_access


def test_course_endpoints_are_mounted():
    paths = {(method, route.path) for route in app.routes for method in route.methods}
    assert ("POST", "/api/courses") in paths
    assert ("POST", "/api/courses/{course_id}/join") in paths
    assert ("GET", "/api/users/{user_id}/profile") in paths


def test_course_backend_contract_is_mounted():
    paths = {(method, route.path) for route in app.routes for method in route.methods}
    expected = {
        ("POST", "/api/courses/{course_id}/documents/upload"),
        ("POST", "/api/courses/{course_id}/documents/{document_id}/parse"),
        ("POST", "/api/courses/{course_id}/extraction/trigger"),
        ("GET", "/api/documents/tasks/{task_id}"),
        ("POST", "/api/courses/{course_id}/qa/ask"),
        ("POST", "/api/qa/{question_id}/feedback"),
        ("POST", "/api/courses/{course_id}/learning-path/progress"),
        ("POST", "/api/courses/{course_id}/learning-path/recommend"),
        ("GET", "/api/courses/{course_id}/learning-path/visualize"),
        ("GET", "/api/courses/{course_id}/overview"),
        ("GET", "/api/courses/{course_id}/members"),
        ("PUT", "/api/courses/{course_id}/members/{user_id}"),
        ("DELETE", "/api/courses/{course_id}/members/{user_id}"),
        ("GET", "/api/courses/{course_id}/documents/{document_id}/download"),
        ("POST", "/api/auth/change-password"),
        ("POST", "/api/auth/logout"),
    }
    assert expected <= paths


class _Query:
    def __init__(self, result):
        self.result = result

    def filter(self, *_conditions):
        return self

    def first(self):
        return self.result


class _Db:
    def __init__(self, course, member=None):
        self.course = course
        self.member = member

    def query(self, model):
        return _Query(self.course if model is Course else self.member)


def test_course_access_requires_membership():
    course = SimpleNamespace(id=7, owner_id="teacher-1")
    with pytest.raises(HTTPException) as exc_info:
        require_course_access(_Db(course), 7, SimpleNamespace(id="student-1"))
    assert exc_info.value.status_code == 403


def test_course_owner_gets_owner_role():
    course = SimpleNamespace(id=7, owner_id="teacher-1")
    ctx = require_course_access(_Db(course), 7, SimpleNamespace(id="teacher-1"), "teacher")
    assert ctx.role == "owner"
