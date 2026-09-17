"""Course-scoped document and knowledge-graph endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user_optional
from ..database import get_db
from ..llm_client import extract_knowledge_graph
from ..parsers import parse_file
from ..permissions import require_course_access
from .documents import _upload_document_impl

course_router = APIRouter(prefix="/api/courses/{course_id}", tags=["course-data"])
task_router = APIRouter(prefix="/api/documents", tags=["documents"])


def _graph(db: Session, course_id: int, category: str | None = None, q: str | None = None):
    query = db.query(models.KGNode).filter(models.KGNode.course_id == course_id)
    if category:
        query = query.filter(models.KGNode.category == category)
    if q:
        pattern = f"%{q}%"
        query = query.filter(or_(models.KGNode.name.ilike(pattern), models.KGNode.description.ilike(pattern)))
    nodes = query.order_by(models.KGNode.name.asc()).all()
    node_ids = {n.id for n in nodes}
    relations = (
        db.query(models.KGRelation)
        .filter(models.KGRelation.course_id == course_id)
        .filter(models.KGRelation.source.in_(node_ids), models.KGRelation.target.in_(node_ids))
        .all()
        if node_ids else []
    )
    return schemas.KnowledgeGraphOut(
        nodes=[schemas.KGNodeOut.model_validate(n) for n in nodes],
        relations=[schemas.KGRelationOut.model_validate(r) for r in relations],
    )


@course_router.get("/graph", response_model=schemas.KnowledgeGraphOut)
def get_course_graph(
    course_id: int,
    category: str | None = Query(None),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user)
    return _graph(db, course_id, category, q)


@course_router.get("/nodes/{node_id}", response_model=schemas.KGNodeOut)
def get_course_node(
    course_id: int,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user)
    node = db.query(models.KGNode).filter(models.KGNode.course_id == course_id, models.KGNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    return node


@course_router.post("/nodes", response_model=schemas.KGNodeOut)
def create_course_node(
    course_id: int,
    payload: schemas.KGNodeOut,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "teacher")
    existing = db.query(models.KGNode).filter(models.KGNode.id == payload.id).first()
    if existing and existing.course_id != course_id:
        raise HTTPException(status_code=409, detail="节点 id 已被其他课程使用")
    node = existing or models.KGNode(id=payload.id, user_id=ctx.user_id, course_id=course_id)
    node.name = payload.name
    node.category = payload.category
    node.description = payload.description
    node.difficulty = payload.difficulty
    node.x = payload.x
    node.y = payload.y
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@course_router.put("/nodes/{node_id}", response_model=schemas.KGNodeOut)
def update_course_node(
    course_id: int,
    node_id: str,
    payload: schemas.KGNodeOut,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "teacher")
    node = db.query(models.KGNode).filter(models.KGNode.course_id == course_id, models.KGNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    node.name = payload.name
    node.category = payload.category
    node.description = payload.description
    node.difficulty = payload.difficulty
    node.x = payload.x
    node.y = payload.y
    node.user_id = ctx.user_id
    db.commit()
    db.refresh(node)
    return node


@course_router.delete("/nodes/{node_id}")
def delete_course_node(
    course_id: int,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user, "teacher")
    node = db.query(models.KGNode).filter(models.KGNode.course_id == course_id, models.KGNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    db.query(models.KGRelation).filter(
        models.KGRelation.course_id == course_id,
        or_(models.KGRelation.source == node_id, models.KGRelation.target == node_id),
    ).delete(synchronize_session=False)
    db.delete(node)
    db.commit()
    return {"ok": True}


@course_router.post("/relations", response_model=schemas.KGRelationOut)
def create_course_relation(
    course_id: int,
    payload: schemas.KGRelationOut,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "teacher")
    for node_id in (payload.source, payload.target):
        if not db.query(models.KGNode).filter(models.KGNode.course_id == course_id, models.KGNode.id == node_id).first():
            raise HTTPException(status_code=400, detail=f"节点 {node_id} 不存在")
    row = db.query(models.KGRelation).filter(models.KGRelation.id == payload.id).first()
    if row and row.course_id != course_id:
        raise HTTPException(status_code=409, detail="关系 id 已被其他课程使用")
    row = row or models.KGRelation(id=payload.id, course_id=course_id, user_id=ctx.user_id)
    row.source = payload.source
    row.target = payload.target
    row.type = payload.type
    row.label = payload.label
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@course_router.delete("/relations/{relation_id}")
def delete_course_relation(
    course_id: int,
    relation_id: str,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user, "teacher")
    row = db.query(models.KGRelation).filter(models.KGRelation.course_id == course_id, models.KGRelation.id == relation_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="关系不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}


@course_router.get("/graph/export")
def export_course_graph(
    course_id: int,
    format: str = Query("json", pattern="^(json|graphml)$"),
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user)
    graph = _graph(db, course_id)
    if format == "json":
        return graph
    lines = [f'<graphml xmlns="http://graphml.graphdrawing.org/xmlns"><graph id="course-{course_id}" edgedefault="directed">']
    lines.extend(f'<node id="{n.id}" />' for n in graph.nodes)
    lines.extend(f'<edge id="{r.id}" source="{r.source}" target="{r.target}" />' for r in graph.relations)
    lines.append("</graph></graphml>")
    return PlainTextResponse("".join(lines), media_type="application/graphml+xml")


@course_router.get("/documents", response_model=list[schemas.DocumentOut])
def list_course_documents(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user)
    return db.query(models.Document).filter(models.Document.course_id == course_id).order_by(models.Document.created_at.desc()).all()


@course_router.post("/documents/upload", response_model=schemas.DocumentTaskOut)
async def upload_course_document(
    course_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "teacher")
    result = await _upload_document_impl(file, db, course_id=course_id, user_id=ctx.user_id)
    task_id = uuid.uuid4().hex
    task = models.ExtractionTask(
        id=task_id,
        course_id=course_id,
        document_id=result.document_id,
        status=result.extract_status,
        nodes_count=result.nodes_count,
        relations_count=result.relations_count,
        error_msg=result.error_msg,
    )
    db.add(task)
    db.commit()
    return schemas.DocumentTaskOut(
        task_id=task_id,
        document_id=result.document_id,
        extract_status=result.extract_status,
        nodes_count=result.nodes_count,
        relations_count=result.relations_count,
        error_msg=result.error_msg,
    )


async def _reextract_course_document(db: Session, document: models.Document, *, course_id: int, user_id: str):
    """Rerun extraction for an existing course document and replace its graph rows."""
    text = document.extracted_text or document.filename
    document.extract_status = "pending"
    document.error_msg = None
    db.commit()
    try:
        try:
            parsed = parse_file(document.stored_path, document.content_type) or ""
            if parsed:
                text = parsed
                document.extracted_text = parsed
        except Exception as parse_error:
            document.error_msg = f"解析失败：{parse_error}"
        result = await extract_knowledge_graph(text)
        prefix = f"c{course_id}_"
        nodes = [{**node, "id": f"{prefix}{node['id']}"} for node in result.nodes]
        source_ids = {node["id"]: f"{prefix}{node['id']}" for node in result.nodes}
        relations = [
            {**relation, "id": f"{prefix}{relation['id']}",
             "source": source_ids.get(relation["source"], f"{prefix}{relation['source']}"),
             "target": source_ids.get(relation["target"], f"{prefix}{relation['target']}" )}
            for relation in result.relations
        ]
        db.query(models.KGRelation).filter(models.KGRelation.document_id == document.id).delete(synchronize_session=False)
        db.query(models.KGNode).filter(models.KGNode.document_id == document.id).delete(synchronize_session=False)
        node_ids: set[str] = set()
        for node in nodes:
            db.add(models.KGNode(
                id=node["id"], name=node["name"], category=node["category"],
                description=node.get("description"), difficulty=float(node.get("difficulty") or 3.0),
                document_id=document.id, course_id=course_id, user_id=user_id,
            ))
            node_ids.add(node["id"])
        db.flush()
        for relation in relations:
            if relation["source"] in node_ids and relation["target"] in node_ids:
                db.add(models.KGRelation(
                    id=relation["id"], source=relation["source"], target=relation["target"],
                    type=relation["type"], label=relation.get("label"), document_id=document.id,
                    course_id=course_id, user_id=user_id,
                ))
        document.extract_status = "done"
        db.commit()
        return len(nodes), len(relations), None
    except Exception as exc:
        document.extract_status = "error"
        document.error_msg = str(exc)
        db.commit()
        return 0, 0, str(exc)


@course_router.post("/documents/{document_id}/parse", response_model=schemas.DocumentTaskOut)
async def parse_course_document(
    course_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "teacher")
    document = db.query(models.Document).filter(
        models.Document.id == document_id, models.Document.course_id == course_id,
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    nodes_count, relations_count, error = await _reextract_course_document(
        db, document, course_id=course_id, user_id=ctx.user_id,
    )
    task = models.ExtractionTask(
        id=uuid.uuid4().hex, course_id=course_id, document_id=document.id,
        status=document.extract_status, nodes_count=nodes_count,
        relations_count=relations_count, error_msg=error,
    )
    db.add(task)
    db.commit()
    return schemas.DocumentTaskOut(
        task_id=task.id, document_id=document.id, extract_status=task.status,
        nodes_count=nodes_count, relations_count=relations_count, error_msg=error,
    )


@course_router.post("/extraction/trigger", response_model=list[schemas.DocumentTaskOut])
async def trigger_course_extraction(
    course_id: int,
    document_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    ctx = require_course_access(db, course_id, current_user, "teacher")
    query = db.query(models.Document).filter(models.Document.course_id == course_id)
    if document_id is not None:
        query = query.filter(models.Document.id == document_id)
    documents = query.order_by(models.Document.created_at.desc()).all()
    if not documents:
        raise HTTPException(status_code=404, detail="课程没有可抽取的文档")
    tasks = []
    for document in documents:
        nodes_count, relations_count, error = await _reextract_course_document(
            db, document, course_id=course_id, user_id=ctx.user_id,
        )
        task = models.ExtractionTask(
            id=uuid.uuid4().hex, course_id=course_id, document_id=document.id,
            status=document.extract_status, nodes_count=nodes_count,
            relations_count=relations_count, error_msg=error,
        )
        db.add(task)
        tasks.append((task, nodes_count, relations_count, error))
    db.commit()
    return [schemas.DocumentTaskOut(
        task_id=task.id, document_id=task.document_id, extract_status=task.status,
        nodes_count=nodes_count, relations_count=relations_count, error_msg=error,
    ) for task, nodes_count, relations_count, error in tasks]


@task_router.get("/tasks/{task_id}", response_model=schemas.DocumentTaskOut)
def get_extraction_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    task = db.query(models.ExtractionTask).filter(models.ExtractionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    require_course_access(db, task.course_id, current_user)
    return schemas.DocumentTaskOut(
        task_id=task.id,
        document_id=task.document_id,
        extract_status=task.status,
        nodes_count=task.nodes_count,
        relations_count=task.relations_count,
        error_msg=task.error_msg,
    )


@course_router.delete("/documents/{document_id}")
def delete_course_document(
    course_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user, "teacher")
    document = db.query(models.Document).filter(models.Document.id == document_id, models.Document.course_id == course_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    for node in db.query(models.KGNode).filter(models.KGNode.document_id == document_id).all():
        db.delete(node)
    for relation in db.query(models.KGRelation).filter(models.KGRelation.document_id == document_id).all():
        db.delete(relation)
    db.delete(document)
    db.commit()
    return {"ok": True}


@course_router.get("/extraction/result", response_model=schemas.ExtractionResultOut)
def extraction_result(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_current_user_optional),
):
    require_course_access(db, course_id, current_user, "teacher")
    graph = _graph(db, course_id)
    return schemas.ExtractionResultOut(nodes=graph.nodes, relations=graph.relations)
