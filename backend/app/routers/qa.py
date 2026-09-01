"""简化版 RAG 问答：关键词检索 + LLM（如果配置了 key）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..llm_client import answer_question

router = APIRouter(prefix="/api/qa", tags=["qa"])


@router.post("/ask", response_model=schemas.QAAnswer)
async def ask(payload: schemas.QARequest, db: Session = Depends(get_db)):
    nodes = db.query(models.KGNode).all()
    answer, related, used_llm = await answer_question(
        question=payload.question,
        all_nodes=nodes,
        use_llm=payload.use_llm,
    )

    # 记录一条历史
    rec = models.QARecord(
        user_id=payload.user_id or "default",
        question=payload.question,
        answer=answer,
        context_nodes=",".join(n.id for n in related),
        used_llm=used_llm,
    )
    db.add(rec)
    db.commit()

    return schemas.QAAnswer(
        answer=answer,
        related_nodes=[schemas.KGNodeOut.model_validate(n) for n in related],
        used_llm=used_llm,
    )


@router.get("/history")
def history(user_id: str = "default", limit: int = 20, db: Session = Depends(get_db)):
    rows = (
        db.query(models.QARecord)
        .filter(models.QARecord.user_id == user_id)
        .order_by(models.QARecord.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "question": r.question,
            "answer": r.answer,
            "used_llm": r.used_llm,
            "related_node_ids": (r.context_nodes or "").split(",") if r.context_nodes else [],
            "created_at": r.created_at,
        }
        for r in rows
    ]
