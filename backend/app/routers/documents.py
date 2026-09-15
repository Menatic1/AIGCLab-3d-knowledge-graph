"""文档上传 + 解析 + 触发知识抽取。"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..llm_client import extract_knowledge_graph
from ..parsers import parse_file

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _ensure_upload_dir():
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


@router.get("", response_model=list[schemas.DocumentOut])
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(models.Document).order_by(models.Document.created_at.desc()).all()
    return docs


@router.post("/upload", response_model=schemas.ExtractTaskOut)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传并直接解析 + 抽取知识图谱（同步返回结果）。

    解析失败返回 status=error，抽取依然会用离线 fallback 以保证不中断流程。
    """
    _ensure_upload_dir()
    filename = file.filename or f"upload_{uuid.uuid4().hex[:8]}"
    safe_name = f"{uuid.uuid4().hex[:12]}_{filename}"
    stored_path = os.path.join(settings.UPLOAD_DIR, safe_name)

    content = await file.read()
    try:
        with open(stored_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"写入文件失败：{e}")

    size_bytes = len(content)
    doc = models.Document(
        filename=filename,
        stored_path=stored_path,
        content_type=file.content_type,
        size_bytes=size_bytes,
        extract_status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 1) 解析文本
    extracted_text = ""
    try:
        extracted_text = parse_file(stored_path, file.content_type) or ""
        doc.extract_status = "done"
    except Exception as e:
        doc.extract_status = "error"
        doc.error_msg = f"解析失败：{e}"
        db.commit()
        # 即便文本解析失败，继续尝试抽取（空文本会用离线回退）
        if not extracted_text:
            extracted_text = filename  # 至少提供文件名作为抽取上下文

    doc.extracted_text = extracted_text
    db.commit()

    # 2) 抽取知识图谱
    try:
        result = await extract_knowledge_graph(extracted_text)
    except Exception as e:
        doc.extract_status = "error"
        doc.error_msg = (doc.error_msg or "") + f" | 抽取异常：{e}"
        db.commit()
        return schemas.ExtractTaskOut(
            document_id=doc.id, extract_status=doc.extract_status, error_msg=doc.error_msg,
        )

    # 3) 写入数据库（按 id upsert：先查存在就合并，否则插入）
    node_map: dict[str, models.KGNode] = {}
    for n in result.nodes:
        existing = db.query(models.KGNode).filter(models.KGNode.id == n["id"]).first()
        if existing:
            existing.name = n["name"]
            existing.category = n["category"]
            existing.description = n["description"]
            existing.difficulty = float(n.get("difficulty") or existing.difficulty)
            existing.document_id = doc.id
            node_map[existing.id] = existing
        else:
            obj = models.KGNode(
                id=n["id"],
                name=n["name"],
                category=n["category"],
                description=n["description"],
                difficulty=float(n.get("difficulty") or 3.0),
                document_id=doc.id,
            )
            db.add(obj)
            node_map[obj.id] = obj
    db.flush()

    inserted_rel = 0
    for r in result.relations:
        if r["source"] not in node_map or r["target"] not in node_map:
            continue
        existing = db.query(models.KGRelation).filter(models.KGRelation.id == r["id"]).first()
        if existing:
            existing.type = r["type"]
            existing.label = r["label"]
            existing.document_id = doc.id
        else:
            rel = models.KGRelation(
                id=r["id"],
                source=r["source"],
                target=r["target"],
                type=r["type"],
                label=r["label"],
                document_id=doc.id,
            )
            db.add(rel)
            inserted_rel += 1
    db.commit()

    doc.extract_status = "done"
    doc.error_msg = None
    db.commit()

    return schemas.ExtractTaskOut(
        document_id=doc.id,
        extract_status=doc.extract_status,
        nodes_count=len(result.nodes),
        relations_count=len(result.relations),
    )


@router.get("/{doc_id}", response_model=schemas.DocumentOut)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "文档不存在")
    return doc


@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "文档不存在")
    # 只删除本文档贡献的节点/关系（其他文档抽取的保留）
    for n in db.query(models.KGNode).filter(models.KGNode.document_id == doc_id).all():
        db.delete(n)
    for r in db.query(models.KGRelation).filter(models.KGRelation.document_id == doc_id).all():
        db.delete(r)
    db.delete(doc)
    db.commit()
    return {"ok": True}
