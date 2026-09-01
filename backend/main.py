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
from app.routers import auth, documents, graph, graphs, progress, learning_path, qa, aigc, tutor
from app.routers.graph import _upsert_sample


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    # 1) 确保目录 & DB 文件存在
    os.makedirs(os.path.dirname(settings.UPLOAD_DIR.rstrip("/").lstrip("./")) or ".", exist_ok=True)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(settings.SQLITE_URL.replace("sqlite:///", "")), exist_ok=True)
    Base.metadata.create_all(bind=engine)

    # 1.5) 数据库迁移：给已存在的表添加 user_id / graph_id 列（SQLite ALTER TABLE）
    from sqlalchemy import inspect as sa_inspect, text
    insp = sa_inspect(engine)
    _mig_cols = {
        "documents": ["user_id"],
        "kg_nodes": ["user_id", "graph_id"],
        "kg_relations": ["user_id", "graph_id"],
    }
    with engine.connect() as conn:
        for table, cols in _mig_cols.items():
            if table not in insp.get_table_names():
                continue
            existing = [c["name"] for c in insp.get_columns(table)]
            for col in cols:
                if col in existing:
                    continue
                if col == "user_id":
                    conn.exec_driver_sql(
                        f'ALTER TABLE "{table}" ADD COLUMN "{col}" VARCHAR(64) DEFAULT "default" NOT NULL'
                    )
                else:  # graph_id 可空
                    conn.exec_driver_sql(
                        f'ALTER TABLE "{table}" ADD COLUMN "{col}" VARCHAR(64) NULL'
                    )
            conn.commit()

    # 2) 首次启动（无任何节点）自动注入示例图谱，保证前端点开就有数据
    #    同时把遗留的「无 graph_id」旧节点归入一个默认图谱，避免列表页丢失
    db = SessionLocal()
    try:
        from app import models  # noqa
        import uuid as _uuid

        cnt = db.query(models.KGNode).count()
        if cnt == 0:
            _upsert_sample(db)

        # 2.1) 给无 graph_id 的节点/关系补一个默认图谱归属
        orphan_nodes = db.query(models.KGNode).filter(models.KGNode.graph_id.is_(None)).all()
        if orphan_nodes:
            # 取第一个孤儿节点的 user_id 作为默认图谱归属
            owner = orphan_nodes[0].user_id or "default"
            default_graph = models.KnowledgeGraph(
                id="default-graph",
                user_id=owner,
                title="默认图谱（历史数据）",
                source="default",
                description="迁移自旧版本的无图谱归属节点",
            )
            db.merge(default_graph)
            db.commit()
            for n in orphan_nodes:
                n.graph_id = "default-graph"
            db.query(models.KGRelation).filter(models.KGRelation.graph_id.is_(None)).update(
                {models.KGRelation.graph_id: "default-graph"}, synchronize_session=False
            )
            # 更新计数
            db.query(models.KnowledgeGraph).filter(
                models.KnowledgeGraph.id == "default-graph"
            ).update({
                models.KnowledgeGraph.nodes_count: db.query(models.KGNode).filter(
                    models.KGNode.graph_id == "default-graph").count(),
                models.KnowledgeGraph.relations_count: db.query(models.KGRelation).filter(
                    models.KGRelation.graph_id == "default-graph").count(),
            }, synchronize_session=False)
            db.commit()
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
app.include_router(graphs.router)
app.include_router(progress.router)
app.include_router(learning_path.router)
app.include_router(qa.router)
app.include_router(aigc.router)
app.include_router(tutor.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"ok": True, "llm_available": bool(settings.LLM_API_KEY and settings.LLM_API_KEY.strip())}
