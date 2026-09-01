"""图谱列表 / 详情 / 删除 / 改名 — 每个课程/文档/AIGC主题对应一份独立图谱。

路由前缀：/api/graphs（注意与旧版 /api/graph 区分；旧版保留用于单图谱查询/编辑）。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/graphs", tags=["graphs"])


def _refresh_counts(db: Session, graph_id: str) -> None:
    """重新统计图谱节点/关系数（删除/迁移后调用）。"""
    n = db.query(models.KGNode).filter(models.KGNode.graph_id == graph_id).count()
    r = db.query(models.KGRelation).filter(models.KGRelation.graph_id == graph_id).count()
    db.query(models.KnowledgeGraph).filter(models.KnowledgeGraph.id == graph_id).update(
        {
            models.KnowledgeGraph.nodes_count: n,
            models.KnowledgeGraph.relations_count: r,
        },
        synchronize_session=False,
    )
    db.commit()


@router.get("", response_model=list[schemas.KnowledgeGraphMetaOut])
def list_graphs(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """列出当前用户的所有图谱（按更新时间倒序）。"""
    rows = (
        db.query(models.KnowledgeGraph)
        .filter(models.KnowledgeGraph.user_id == user.id)
        .order_by(models.KnowledgeGraph.updated_at.desc())
        .all()
    )
    return rows


@router.get("/{graph_id}", response_model=schemas.KnowledgeGraphDetailOut)
def get_graph_detail(
    graph_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """获取某份图谱的元信息 + 节点 + 关系。"""
    g = db.query(models.KnowledgeGraph).filter(
        models.KnowledgeGraph.id == graph_id,
        models.KnowledgeGraph.user_id == user.id,
    ).first()
    if not g:
        raise HTTPException(404, "图谱不存在或无权访问")
    nodes = db.query(models.KGNode).filter(models.KGNode.graph_id == graph_id).all()
    node_ids = {n.id for n in nodes}
    rels = db.query(models.KGRelation).filter(
        models.KGRelation.graph_id == graph_id,
        models.KGRelation.source.in_(node_ids),
        models.KGRelation.target.in_(node_ids),
    ).all()
    return {
        **_meta_dict(g),
        "nodes": [schemas.KGNodeOut.model_validate(n) for n in nodes],
        "relations": [schemas.KGRelationOut.model_validate(r) for r in rels],
    }


@router.patch("/{graph_id}", response_model=schemas.KnowledgeGraphMetaOut)
def update_graph_meta(
    graph_id: str,
    payload: schemas.GraphMetaUpdateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """改名/改描述。"""
    g = db.query(models.KnowledgeGraph).filter(
        models.KnowledgeGraph.id == graph_id,
        models.KnowledgeGraph.user_id == user.id,
    ).first()
    if not g:
        raise HTTPException(404, "图谱不存在或无权访问")
    if payload.title is not None:
        g.title = payload.title
    if payload.description is not None:
        g.description = payload.description
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{graph_id}")
def delete_graph(
    graph_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """删除整份图谱（含其下所有节点/关系/学习进度）。

    注意：节点级联删除会带走 KGRelation，但 UserProgress 也挂在节点上，需手动清。
    """
    g = db.query(models.KnowledgeGraph).filter(
        models.KnowledgeGraph.id == graph_id,
        models.KnowledgeGraph.user_id == user.id,
    ).first()
    if not g:
        raise HTTPException(404, "图谱不存在或无权访问")

    # 收集节点 id，先清进度（避免外键约束）
    node_ids = [n.id for n in db.query(models.KGNode)
                .filter(models.KGNode.graph_id == graph_id).all()]
    if node_ids:
        db.query(models.UserProgress).filter(
            models.UserProgress.node_id.in_(node_ids)
        ).delete(synchronize_session=False)

    # 删节点（关系由 ondelete=CASCADE 自动带走）
    db.query(models.KGNode).filter(models.KGNode.graph_id == graph_id).delete(synchronize_session=False)
    # 兜底：直接删一遍关系
    db.query(models.KGRelation).filter(models.KGRelation.graph_id == graph_id).delete(synchronize_session=False)
    # 删图谱元
    db.delete(g)
    db.commit()
    return {"ok": True, "deleted_nodes": len(node_ids)}


def _meta_dict(g: models.KnowledgeGraph) -> dict:
    return {
        "id": g.id,
        "user_id": g.user_id,
        "title": g.title,
        "source": g.source,
        "source_ref": g.source_ref,
        "description": g.description,
        "nodes_count": g.nodes_count,
        "relations_count": g.relations_count,
        "created_at": g.created_at,
        "updated_at": g.updated_at,
    }
