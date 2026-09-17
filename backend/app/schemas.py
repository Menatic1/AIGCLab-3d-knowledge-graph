from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Literal

from pydantic import BaseModel, Field


class CourseOut(BaseModel):
    id: int
    owner_id: str
    name: str
    description: Optional[str] = None
    role: Optional[Literal["owner", "teacher", "student"]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CourseCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class CourseUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)


class CourseJoinOut(BaseModel):
    course: CourseOut
    already_member: bool


class UserProfileOut(BaseModel):
    id: str
    username: str
    role: Literal["teacher", "student"]


class UserProfileUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=32)


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


class DocumentTaskOut(BaseModel):
    task_id: str
    document_id: int
    extract_status: str
    nodes_count: int = 0
    relations_count: int = 0
    error_msg: Optional[str] = None


class ExtractionResultOut(BaseModel):
    nodes: List[KGNodeOut]
    relations: List[KGRelationOut]


class QAFeedbackRequest(BaseModel):
    helpful: bool
    comment: Optional[str] = Field(None, max_length=1000)


class QAFeedbackOut(BaseModel):
    question_id: int
    helpful: bool
    comment: Optional[str] = None


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


# ---------------- Adaptive learning / Quiz ----------------
LearningPreference = Literal["reinforce", "balanced", "challenge"]


class QuizSubmitRequest(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=64)
    correct_count: int = Field(..., ge=0, le=100)
    total_count: int = Field(..., ge=1, le=100)


class QuizAttemptOut(BaseModel):
    id: int
    node_id: str
    correct_count: int
    total_count: int
    accuracy: float
    passed: bool
    completed_at: datetime

    class Config:
        from_attributes = True


class LearningPreferenceUpdate(BaseModel):
    preference: LearningPreference


class LearningRecommendationOut(BaseModel):
    node_id: str
    name: str
    category: str
    description: Optional[str] = None
    importance: float = 3.0
    priority: int
    prerequisites: List[str] = []
    missing_prerequisites: List[str] = []
    latest_accuracy: Optional[float] = None
    reason: str


class LearningReportOut(BaseModel):
    user_id: str
    learning_preference: LearningPreference
    total_nodes: int
    mastered_nodes: int
    mastery_rate: float
    mastered_node_ids: List[str] = []
    quiz_count: int
    average_accuracy: Optional[float] = None
    weak_node_ids: List[str] = []
    recent_attempts: List[QuizAttemptOut] = []
