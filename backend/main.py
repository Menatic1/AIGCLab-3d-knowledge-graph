"""AIGC 课程知识图谱 — FastAPI 后端入口。

运行方法：
  cd backend
  cp .env.example .env    # 可选，填写 LLM API key 后启用高质量抽取与问答
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

接口文档（启动后打开）：
  http://localhost:8000/docs
  http://localhost:8000/redoc
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import auth, documents, graph, progress, learning_path, qa, aigc, learning, courses, users, course_data, course_learning
from app.routers.graph import _upsert_sample


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    # 1) 确保目录 & DB 文件存在
    os.makedirs(os.path.dirname(settings.UPLOAD_DIR.rstrip("/").lstrip("./")) or ".", exist_ok=True)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(settings.SQLITE_URL.replace("sqlite:///", "")), exist_ok=True)
    Base.metadata.create_all(bind=engine)

    # 1.5) 数据库迁移：给已存在的表添加 user_id 列（SQLite ALTER TABLE）
    from sqlalchemy import inspect as sa_inspect
    insp = sa_inspect(engine)
    _mig_cols = {
        "users": ("role", "student"),
        "documents": ("user_id", "default"),
        "kg_nodes": ("user_id", "default"),
        "kg_relations": ("user_id", "default"),
    }
    with engine.connect() as conn:
        for table, (col, default) in _mig_cols.items():
            if table in insp.get_table_names():
                cols = [c["name"] for c in insp.get_columns(table)]
                if col not in cols:
                    conn.exec_driver_sql(
                        f'ALTER TABLE "{table}" ADD COLUMN "{col}" VARCHAR(64) DEFAULT "{default}" NOT NULL'
                    )
                    conn.commit()

        # New course-scoped records are nullable for backwards compatibility
        # with the pre-course database created by the first demo version.
        for table in ("documents", "kg_nodes", "kg_relations", "user_progress", "qa_records"):
            if table not in insp.get_table_names():
                continue
            cols = [c["name"] for c in insp.get_columns(table)]
            if "course_id" not in cols:
                conn.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "course_id" INTEGER')
                conn.commit()
            if table == "qa_records":
                if "feedback_helpful" not in cols:
                    conn.exec_driver_sql('ALTER TABLE "qa_records" ADD COLUMN "feedback_helpful" BOOLEAN')
                    conn.commit()
                if "feedback_comment" not in cols:
                    conn.exec_driver_sql('ALTER TABLE "qa_records" ADD COLUMN "feedback_comment" VARCHAR(1000)')
                    conn.commit()
            if table in {"kg_nodes", "kg_relations"}:
                if "confidence" not in cols:
                    conn.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "confidence" FLOAT')
                    conn.commit()
                if "review_status" not in cols:
                    conn.exec_driver_sql(
                        f'ALTER TABLE "{table}" ADD COLUMN "review_status" VARCHAR(32) DEFAULT "confirmed" NOT NULL'
                    )
                    conn.commit()

    # 2) 首次启动（无任何节点）自动注入示例图谱，保证前端一点开就有数据
    db = SessionLocal()
    try:
        from app import models  # noqa
        cnt = db.query(models.KGNode).count()
        if cnt == 0:
            _upsert_sample(db)
    finally:
        db.close()

    yield  # 启动完成；关闭逻辑可写在这之后


app = FastAPI(
    title="AIGC 课程知识图谱后端",
    version="0.1.0",
    description="文档解析 → AI 知识抽取 → 图谱 CRUD → RAG 问答 → 学习路径推荐",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"] if not settings.cors_origin_list else settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(graph.router)
app.include_router(progress.router)
app.include_router(learning_path.router)
app.include_router(qa.router)
app.include_router(aigc.router)
app.include_router(learning.router)
app.include_router(courses.router)
app.include_router(users.router)
app.include_router(course_data.course_router)
app.include_router(course_data.task_router)
app.include_router(course_learning.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"ok": True, "llm_available": bool(settings.LLM_API_KEY and settings.LLM_API_KEY.strip())}
