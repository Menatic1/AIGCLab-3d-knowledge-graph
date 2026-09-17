from main import app


def test_openapi_contains_course_contract_paths():
    paths = set(app.openapi()["paths"])
    expected = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/courses",
        "/api/courses/{course_id}",
        "/api/courses/{course_id}/documents/upload",
        "/api/courses/{course_id}/documents/{document_id}/parse",
        "/api/courses/{course_id}/extraction/trigger",
        "/api/courses/{course_id}/extraction/result",
        "/api/courses/{course_id}/graph",
        "/api/courses/{course_id}/graph/export",
        "/api/courses/{course_id}/qa/ask",
        "/api/courses/{course_id}/qa/history",
        "/api/courses/{course_id}/learning-path/recommend",
        "/api/courses/{course_id}/learning-path/progress",
        "/api/courses/{course_id}/learning-path/visualize",
        "/api/qa/{question_id}/feedback",
        "/api/users/{user_id}/profile",
    }
    assert expected <= paths
