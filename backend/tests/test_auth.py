import pytest
from fastapi import HTTPException

from app.auth import create_token, get_current_user_optional
from app.models import User


class _Query:
    def __init__(self, result):
        self.result = result

    def filter(self, *_conditions):
        return self

    def first(self):
        return self.result


class _Db:
    def __init__(self, user):
        self.user = user

    def query(self, _model):
        return _Query(self.user)


def test_optional_auth_allows_anonymous_requests():
    assert get_current_user_optional("", _Db(None)) is None


def test_optional_auth_rejects_invalid_bearer_token():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_optional("Bearer invalid-token", _Db(None))

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Token 无效或已过期"


def test_optional_auth_resolves_a_valid_bearer_token():
    user = User(id="user-1", username="alice", role="student")
    token = create_token(user.id, user.username)

    assert get_current_user_optional(f"Bearer {token}", _Db(user)) is user
