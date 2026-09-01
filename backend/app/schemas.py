from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Literal

from pydantic import BaseModel, Field


# ---------------- Graph ----------------
class KGNodeOut(BaseModel):
    id: str
    name: str
    category: str = "核心概念"
    description: Optional[str] = None
    difficulty: float = 3.0
    x: Optional[float] = None
    y: Optional[float] = None

    class Config:
        from_attributes = True


class KGRelationOut(BaseModel):
    id: str
    source: str
    target: str
    type: str
    label: Optional[str] = None

    class Config:
        from_attributes = True


class KnowledgeGraphOut(BaseModel):
    nodes: List[KGNodeOut]
    relations: List[KGRelationOut]


class CategoryStat(BaseModel):
    category: str
    count: int


# ---------------- Knowledge Graph Meta（图谱列表）----------------
class KnowledgeGraphMetaOut(BaseModel):
    """图谱列表项：每份独立图谱的元信息（不含节点详情）。"""
    id: str
    user_id: str
    title: str
    source: str  # aigc / document / sample / default
    source_ref: Optional[str] = None
    description: Optional[str] = None
    nodes_count: int = 0
    relations_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class KnowledgeGraphDetailOut(BaseModel):
    """图谱详情：元信息 + 节点 + 关系。"""
    id: str
    user_id: str
    title: str
    source: str
    source_ref: Optional[str] = None
    description: Optional[str] = None
    nodes_count: int = 0
    relations_count: int = 0
    created_at: datetime
    updated_at: datetime
    nodes: List[KGNodeOut] = []
    relations: List[KGRelationOut] = []

    class Config:
        from_attributes = True


class GraphMetaUpdateRequest(BaseModel):
    """改名/改描述"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None


# ---------------- Documents ----------------
class DocumentOut(BaseModel):
    id: int
    filename: str
    content_type: Optional[str] = None
    size_bytes: int
    extract_status: str
    error_msg: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExtractTaskOut(BaseModel):
    document_id: int
    extract_status: str
    nodes_count: int = 0
    relations_count: int = 0
    error_msg: Optional[str] = None
    graph_id: Optional[str] = None  # 该文档对应的独立图谱 id


# ---------------- QA ----------------
class QARequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    user_id: str = "default"
    use_llm: Optional[bool] = None  # None 自动：有 key 就走 LLM，否则走关键词


class QAAnswer(BaseModel):
    answer: str
    related_nodes: List[KGNodeOut] = []
    used_llm: bool


# ---------------- Progress ----------------
class ProgressItem(BaseModel):
    node_id: str
    mastered: bool = False
    score: float = 0.0


class ProgressUpdateRequest(BaseModel):
    user_id: str = "default"
    items: List[ProgressItem]


class ProgressOut(BaseModel):
    user_id: str
    total: int
    mastered: int
    mastery_rate: float
    items: List[ProgressItem]


# ---------------- Learning Path ----------------
class PathRecommendRequest(BaseModel):
    user_id: str = "default"
    start_node_id: Optional[str] = None          # 指定起点（可选）
    target_node_id: Optional[str] = None         # 指定终点（可选）
    max_items: int = 30
    # 关系类型权重：默认把 "先修" 当 DAG 边方向
    prerequisite_relation_types: List[str] = ["先修", "前置", "prerequisite", "依赖"]


class PathStep(BaseModel):
    node_id: str
    name: str
    category: str
    description: Optional[str]
    mastered: bool
    prerequisites: List[str]          # 这一步学习前需要掌握的节点 id
    reason: str                        # 为什么推荐这一步


class LearningPathOut(BaseModel):
    steps: List[PathStep]
    total_steps: int
    remaining: int
