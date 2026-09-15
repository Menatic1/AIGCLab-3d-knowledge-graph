# Backend Service

The backend is a FastAPI service for document upload and parsing, knowledge extraction, graph management, learning-path calculation, progress tracking, and graph-grounded Q&A.

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

## Adaptive Learning API

The student learning loop persists to SQLite and can be consumed independently by the frontend.

- `POST /api/quiz/submit` - records a quiz result and automatically updates mastery at 67%.
- `GET /api/learning/report` - learning report, weak knowledge points, and recent attempts.
- `GET /api/learning/recommendations` - dynamic next-step recommendations based on prerequisites, quiz performance, and preference.
- `PUT /api/learning/preference` - saves `reinforce`, `balanced`, or `challenge`.

Open `http://127.0.0.1:8000/docs` after starting the API to try every request interactively.
