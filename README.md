# AIGC Course Knowledge Graph

An AIGC-powered course knowledge graph and learning navigation system. Teachers can upload and refine course content; students can explore a 3D graph, study multimodal resources, follow recommended paths, and ask questions based on course knowledge.

## Project Layout

```text
.
├── frontend/              React and Vite web application
│   ├── src/               Pages, 3D graph, learning flow, and UI components
│   └── public/models/     3D campus model assets
├── backend/               FastAPI service
│   ├── app/               API routes, parsing, graph, Q&A, and persistence modules
│   └── data/              Runtime data and curated sample materials
└── docs/                  Teacher and student implementation documentation
```

## Run Locally

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The web application uses `http://localhost:8000` as its default API address.
