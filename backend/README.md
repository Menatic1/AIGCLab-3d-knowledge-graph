# Backend Service

The backend is a FastAPI service for document upload and parsing, knowledge extraction, graph management, learning-path calculation, progress tracking, and graph-grounded Q&A.

```text
backend/
├── app/
│   ├── routers/           API endpoint modules
│   ├── auth.py            Authentication helpers
│   ├── parsers.py         PDF, Word, PowerPoint, and text parsing
│   ├── llm_client.py      Large language model client
│   └── models.py          Persistence models
├── data/
│   ├── samples/           Curated sample course materials
│   └── uploads/           Runtime uploads, excluded from Git
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
