from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)  # UUID
    username = Column(String(64), nullable=False, unique=True, index=True)
    hashed_password = Column(String(256), nullable=False)
    salt = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, default="default", index=True)
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(512), nullable=False)
    content_type = Column(String(128), nullable=True)
    size_bytes = Column(Integer, nullable=False, default=0)
    extracted_text = Column(Text, nullable=True)
    extract_status = Column(String(32), nullable=False, default="pending")  # pending/done/error
    error_msg = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    relations = relationship("KGRelation", back_populates="document", cascade="all, delete-orphan")
    nodes = relationship("KGNode", back_populates="document", cascade="all, delete-orphan")


class KnowledgeGraph(Base):
    """一份独立的知识图谱元数据（每个课程/文档/AIGC主题生成对应一份）。

    用于支撑「我的图谱」列表页，以及让不同图谱的节点 ID 不再冲突。
    """
    __tablename__ = "knowledge_graphs"

    id = Column(String(64), primary_key=True)  # UUID
    user_id = Column(String(64), nullable=False, default="default", index=True)
    title = Column(String(255), nullable=False)            # 图谱标题（课程主题 / 文档名 / 自定义）
    source = Column(String(32), nullable=False, default="aigc")  # aigc / document / sample / default
    source_ref = Column(String(255), nullable=True)        # document_id 或 topic 文本
    description = Column(Text, nullable=True)
    nodes_count = Column(Integer, nullable=False, default=0)
    relations_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    nodes = relationship("KGNode", back_populates="graph", foreign_keys="KGNode.graph_id",
                         cascade="all, delete-orphan")
    relations = relationship("KGRelation", back_populates="graph", foreign_keys="KGRelation.graph_id",
                             cascade="all, delete-orphan")


class KGNode(Base):
    __tablename__ = "kg_nodes"

    id = Column(String(64), primary_key=True)  # 业务 id：新生成时带 graph_id 前缀，避免跨图谱冲突
    user_id = Column(String(64), nullable=False, default="default", index=True)
    graph_id = Column(String(64), ForeignKey("knowledge_graphs.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(64), nullable=False, default="核心概念")
    description = Column(Text, nullable=True)
    difficulty = Column(Float, nullable=False, default=3.0)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="nodes")
    graph = relationship("KnowledgeGraph", back_populates="nodes", foreign_keys=[graph_id])
    progress_list = relationship("UserProgress", back_populates="node", cascade="all, delete-orphan")


class KGRelation(Base):
    __tablename__ = "kg_relations"
    __table_args__ = (UniqueConstraint("source", "target", "type", name="uq_kg_relation"),)

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, default="default", index=True)
    graph_id = Column(String(64), ForeignKey("knowledge_graphs.id", ondelete="CASCADE"), nullable=True, index=True)
    source = Column(String(64), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    target = Column(String(64), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(64), nullable=False, default="关联")
    label = Column(String(128), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="relations")
    graph = relationship("KnowledgeGraph", back_populates="relations", foreign_keys=[graph_id])


class UserProgress(Base):
    __tablename__ = "user_progress"
    __table_args__ = (UniqueConstraint("user_id", "node_id", name="uq_user_node_progress"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, default="default", index=True)
    node_id = Column(String(64), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    mastered = Column(Boolean, nullable=False, default=False)
    score = Column(Float, nullable=False, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    node = relationship("KGNode", back_populates="progress_list")


class QARecord(Base):
    __tablename__ = "qa_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, default="default", index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    context_nodes = Column(Text, nullable=True)  # JSON: 命中的节点 id 列表
    used_llm = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ==================== AI 讲题老师 ====================
class TutorSession(Base):
    """一次讲题会话"""
    __tablename__ = "tutor_sessions"

    id = Column(String(64), primary_key=True)  # UUID
    user_id = Column(String(64), nullable=False, index=True)
    problem_text = Column(Text, nullable=True)              # 题目文本（文字输入或 OCR 识别结果）
    problem_latex = Column(Text, nullable=True)             # 题目结构化 LaTeX / 条件
    problem_image_path = Column(String(512), nullable=True) # 原始图片存储路径
    located_node_ids = Column(Text, nullable=True)          # JSON: 命中的知识点节点 id 列表
    prereq_chain = Column(Text, nullable=True)              # JSON: 补讲队列 [node_id,...]
    teaching_plan = Column(Text, nullable=True)             # JSON: 完整教学计划（LLM 生成）
    status = Column(String(32), nullable=False, default="planning")  # planning/teaching/practicing/done
    current_step = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    steps = relationship("TutorStep", back_populates="session", cascade="all, delete-orphan",
                         order_by="TutorStep.index")
    exercises = relationship("TutorExercise", back_populates="session", cascade="all, delete-orphan")


class TutorStep(Base):
    """教学队列中的每一步（前置补讲 + 原题分步）"""
    __tablename__ = "tutor_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("tutor_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    index = Column(Integer, nullable=False)                 # 步骤序号 0,1,2...
    kind = Column(String(32), nullable=False, default="prereq")  # prereq(前置补讲) / solve(原题解题)
    node_id = Column(String(64), nullable=True)            # 关联的知识点节点
    node_name = Column(String(255), nullable=True)
    board = Column(Text, nullable=True)                    # JSON: 板书指令序列（笔迹/公式/图形）
    narration = Column(Text, nullable=True)                # 讲解文本
    verify_question = Column(Text, nullable=True)          # 即时验证提问
    verify_answer = Column(Text, nullable=True)            # 验证提问的标准答案
    status = Column(String(32), nullable=False, default="pending")  # pending/teaching/understood/unclear/skipped
    feedback = Column(Text, nullable=True)                  # JSON: 用户反馈记录
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("TutorSession", back_populates="steps")


class TutorExercise(Base):
    """巩固变式练习题"""
    __tablename__ = "tutor_exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("tutor_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    node_id = Column(String(64), nullable=True)
    question = Column(Text, nullable=False)
    choices = Column(Text, nullable=True)                  # JSON: 选项（选择题）
    answer = Column(Text, nullable=False)                  # 标准答案
    explanation = Column(Text, nullable=True)              # 解析
    difficulty = Column(Integer, nullable=False, default=3)
    user_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("TutorSession", back_populates="exercises")


class MasteryEvent(Base):
    """掌握度更新事件日志（轻量贝叶斯知识追踪 BKT 的证据来源）"""
    __tablename__ = "mastery_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, index=True)
    session_id = Column(String(64), ForeignKey("tutor_sessions.id", ondelete="SET NULL"), nullable=True)
    node_id = Column(String(64), nullable=False, index=True)
    event_type = Column(String(32), nullable=False)        # understood/unclear/question_wrong/exercise_correct/exercise_wrong
    delta = Column(Float, nullable=False, default=0.0)     # 掌握度增量
    new_score = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
