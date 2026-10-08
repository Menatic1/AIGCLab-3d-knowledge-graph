# Full Course Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete the course-aware backend described by the teacher and student design documents while preserving the current 26 documented API operations and keeping the frontend integration usable.

**Architecture:** Add course ownership and membership as the authorization boundary, then scope documents, graph records, questions, and learning records through the authenticated course context. Keep FastAPI routers thin, put repeated scope checks in dependencies/services, use SQLite-compatible additive migrations, and expose task, profile, feedback, graph-edit, and course endpoints required by the design documents.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2, Pydantic, SQLite, pytest, React/TypeScript frontend, Vite.

**Spec:** `docs/接口文档.md`, `docs/教师端技术开发文档.md`, `docs/学生端技术开发文档.md`

## Global Constraints

- Preserve the existing `/api` base path and existing request/response field names unless an endpoint is being added.
- Anonymous requests may use the `default` compatibility user; invalid explicit Bearer tokens return HTTP 401.
- Teacher-only mutations require a teacher role and course ownership or teacher membership.
- Student course data is readable only after membership; teacher data is readable only for courses they own or teach.
- SQLite startup migrations must be additive and safe when the database already contains the current tables.
- Every new behavior gets a failing test before production code and is verified with `python -m pytest -q` and `npm run build` before upload.

---

### Task 1: Establish database and authorization primitives

**Files:**
- Create: `backend/tests/test_courses.py`
- Create: `backend/app/permissions.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/auth.py`
- Modify: `backend/main.py`

**Interfaces:**
- `Course(id: int, owner_id: str, name: str, description: str | None, created_at, updated_at)`.
- `CourseMember(course_id: int, user_id: str, role: Literal['owner','teacher','student'], created_at)` with a unique `(course_id, user_id)` constraint.
- `get_authenticated_user()` remains strict; `get_current_user_optional()` returns `None` only when the header is absent.
- `require_course_access(course_id, minimum_role)` returns `(db, user, course)` and raises 401/403/404 consistently.

- [x] Write tests for course ownership, student membership denial, teacher access, and invalid-token rejection.
- [x] Run `python -m pytest tests/test_courses.py -q` and verify the new tests fail because the models and dependency do not exist.
- [x] Add the models and additive SQLite migration for `courses` and `course_members`; add `role` checks to the shared permission helpers.
- [x] Run the focused tests and verify they pass.

### Task 2: Add course and profile endpoints

**Files:**
- Create: `backend/app/routers/courses.py`
- Create: `backend/app/routers/users.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_courses.py`

**Interfaces:**
- `GET /api/courses` lists courses visible to the current user.
- `POST /api/courses` creates a teacher-owned course and returns `CourseOut`.
- `GET /api/courses/{course_id}` returns course metadata for members.
- `PUT /api/courses/{course_id}` updates name/description for owners and teachers.
- `DELETE /api/courses/{course_id}` deletes a course for its owner.
- `POST /api/courses/{course_id}/join` is idempotent and returns `{course, already_member}`.
- `GET /api/users/{user_id}/profile` and `PUT /api/users/{user_id}/profile` expose the allowed profile fields; users can edit only themselves.

- [x] Write endpoint tests for create/list/detail/update/delete and idempotent join.
- [x] Run the focused tests and verify they fail with 404 because the routers are not mounted.
- [x] Implement schemas, routers, and router registration.
- [x] Run focused tests and verify role and membership cases pass.

### Task 3: Scope documents and extraction tasks to courses

**Files:**
- Create: `backend/app/services/document_tasks.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/documents.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_documents.py`

**Interfaces:**
- Add `course_id` to documents, nodes, relations, and task records with additive migration defaults.
- `POST /api/courses/{course_id}/documents/upload` returns `{task_id, document_id, extract_status}`.
- `GET /api/courses/{course_id}/documents` lists only course documents.
- `POST /api/courses/{course_id}/documents/{document_id}/parse` queues or reruns extraction.
- `GET /api/documents/tasks/{task_id}` returns status, error, counts, and timestamps.
- `DELETE /api/courses/{course_id}/documents/{document_id}` requires teacher access and removes only that document's derived records.
- Keep `/api/documents/upload` as a compatibility wrapper using the default course context when no course is supplied.

- [x] Write tests for course ownership, task creation, task status, rerun, and cross-course denial.
- [x] Run tests to capture expected failures.
- [x] Implement task persistence and the synchronous worker-compatible execution path; the API contract remains task-shaped even when the local worker runs inline.
- [x] Verify tests and parser smoke coverage.

### Task 4: Complete course-scoped graph CRUD and extraction review

**Files:**
- Modify: `backend/app/routers/graph.py`
- Modify: `backend/app/routers/documents.py`
- Modify: `backend/app/schemas.py`
- Create: `backend/tests/test_graph.py`

**Interfaces:**
- Add course-scoped `GET /api/courses/{course_id}/graph` with `category` and `q` filters.
- Add `GET /api/courses/{course_id}/nodes/{node_id}`.
- Add `POST /api/courses/{course_id}/nodes`, `PUT /api/courses/{course_id}/nodes/{node_id}`, and `DELETE /api/courses/{course_id}/nodes/{node_id}`.
- Add `POST /api/courses/{course_id}/relations` and `DELETE /api/courses/{course_id}/relations/{relation_id}`.
- Add `GET /api/courses/{course_id}/graph/export?format=json|graphml`.
- Add `GET /api/courses/{course_id}/extraction/result` with review status filtering.
- Add teacher-only `POST /api/courses/{course_id}/extraction/trigger`.
- Preserve existing `/api/graph` endpoints as default-course compatibility wrappers.

- [x] Write tests for CRUD, course isolation, relation validation, export, and extraction review filtering.
- [x] Verify failures before implementation.
- [x] Implement the shared course graph query and router endpoints.
- [x] Run focused and full backend tests.

### Task 5: Complete course-scoped QA, feedback, progress, and learning-path APIs

**Files:**
- Modify: `backend/app/routers/qa.py`
- Modify: `backend/app/routers/progress.py`
- Modify: `backend/app/routers/learning_path.py`
- Modify: `backend/app/routers/learning.py`
- Modify: `backend/app/schemas.py`
- Create: `backend/tests/test_learning_and_qa.py`

**Interfaces:**
- Add `POST /api/courses/{course_id}/qa/ask` and `GET /api/courses/{course_id}/qa/history`.
- Add `POST /api/qa/{question_id}/feedback` with `helpful: bool` and optional comment.
- Add `GET /api/courses/{course_id}/learning-path/{user_id}/progress` for teacher read access and self read access.
- Add `POST /api/courses/{course_id}/learning-path/progress` for self updates and teacher corrections.
- Add `POST /api/courses/{course_id}/learning-path/recommend` and `GET /api/courses/{course_id}/learning-path/visualize`.
- Keep existing non-course learning routes as default-course wrappers.

- [x] Write tests for membership access, feedback persistence, student self-update, teacher correction, and visualization output.
- [x] Verify failures before implementation.
- [x] Implement course filters and shared learning service parameters.
- [x] Run focused and full backend tests.

### Task 6: Wire real frontend authentication and backend-backed editing

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/context/KnowledgeContext.tsx`
- Modify: `frontend/src/api/learning.ts`
- Create or modify: `frontend/src/api/courses.ts`
- Modify: `frontend/src/lib/graphMap.ts`

**Interfaces:**
- Login and registration call `/api/auth/login` and `/api/auth/register`; returned token/user populate local storage.
- Startup calls `/api/auth/me` when a saved token exists and clears expired credentials on 401.
- Upload, graph reads, quiz, learning, QA, and graph edits send the real Bearer token.
- Frontend fallback data remains available only when the backend is unreachable, not when the backend returns an authorization error.

- [x] Add frontend tests or type-level fixtures for auth response mapping and API error handling.
- [x] Run `npm run build` before and after implementation.
- [x] Implement the API client changes without changing route names or user-facing copy.
- [x] Run the full frontend build and backend test suite.

### Task 7: Publish the complete contract and upload

**Files:**
- Modify: `docs/接口文档.md`
- Modify: `backend/README.md`
- Create: `backend/tests/test_openapi_contract.py`

- [x] Write a route contract test asserting all current and course-scoped paths are present in `app.openapi()`.
- [x] Run it and verify any missing paths fail explicitly.
- [x] Update the Chinese API document with request/response examples, auth requirements, and task semantics.
- [x] Run `python -m pytest -q`, `npm run build`, `git diff --check`, and inspect `git status`.
- [x] Commit with a descriptive message and push the feature branch.
- [x] Report the branch, commit, tests, and remaining review/merge action.
