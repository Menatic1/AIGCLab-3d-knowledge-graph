# Backend Service

The backend is a FastAPI service for authenticated course workspaces: document upload and parsing, course-scoped knowledge extraction, graph management, learning-path calculation, progress tracking, feedback, and graph-grounded Q&A. The original flat `/api/graph`, `/api/documents`, `/api/progress`, and `/api/qa` routes remain available for the demo compatibility flow.

```text
backend/
├── app/
│   ├── routers/           API endpoint modules
│   ├── services/          Business rules for adaptive learning
│   ├── auth.py            Authentication helpers
│   ├── parsers.py         PDF, Word, PowerPoint, and text parsing
│   ├── llm_client.py      Large language model client
│   └── models.py          Persistence models
├── data/
│   ├── samples/           Curated sample course materials
│   └── uploads/           Runtime uploads, excluded from Git
├── scripts/               Local validation and development utilities
├── main.py                FastAPI entry point
└── requirements.txt       Python dependencies
```

## Start the API

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Copy `.env.example` to `.env` before configuring an LLM provider. Never commit `.env` or uploaded course files.

## Course and authentication flow

1. Register or log in through `POST /api/auth/register` or `POST /api/auth/login`.
2. Send the returned token as `Authorization: Bearer <token>`.
3. Teachers create a course with `POST /api/courses`; students join with `POST /api/courses/{course_id}/join`.
4. Use the course-scoped document, graph, QA, and learning-path routes. Course uploads namespace extracted node and relation ids by course so two courses cannot overwrite each other's graph.

Course management endpoints include `GET /api/courses/{course_id}/overview` for dashboard totals, `GET /api/courses/{course_id}/members` for the teacher roster, and owner-only member role updates. Teachers can download original uploads and query extraction tasks. Course graph rows carry `confidence` and `review_status`; new extraction rows start at `pending_review`, manual edits become `confirmed` or `manually_edited`, and deletions are retained as `discarded` for audit and review filtering. `POST /api/auth/change-password` changes the current password, while `POST /api/auth/logout` confirms client-side token removal for the stateless token flow.

The complete request and response contract is maintained in [`docs/接口文档.md`](../docs/接口文档.md), and FastAPI exposes the same routes through `/docs` and `/redoc`.

## Adaptive Learning API

The student learning loop persists to SQLite and can be consumed independently by the frontend.

- `POST /api/quiz/submit` - records a quiz result and automatically updates mastery at 67%.
- `GET /api/learning/report` - learning report, weak knowledge points, and recent attempts.
- `GET /api/learning/recommendations` - dynamic next-step recommendations based on prerequisites, quiz performance, and preference.
- `PUT /api/learning/preference` - saves `reinforce`, `balanced`, or `challenge`.

Open `http://127.0.0.1:8000/docs` after starting the API to try every request interactively.
