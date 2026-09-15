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
    role = Column(String(16), nullable=False, default="student")
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


class KGNode(Base):
    __tablename__ = "kg_nodes"

    id = Column(String(64), primary_key=True)  # 业务 id：如 n1、协议的 md5 等，和前端一致
    user_id = Column(String(64), nullable=False, default="default", index=True)
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
    progress_list = relationship("UserProgress", back_populates="node", cascade="all, delete-orphan")


class KGRelation(Base):
    __tablename__ = "kg_relations"
    __table_args__ = (UniqueConstraint("source", "target", "type", name="uq_kg_relation"),)

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, default="default", index=True)
    source = Column(String(64), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    target = Column(String(64), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(64), nullable=False, default="关联")
    label = Column(String(128), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="relations")


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


class LearningProfile(Base):
    """学生学习偏好；允许 default 访客使用同一套学习接口。"""
    __tablename__ = "learning_profiles"

    user_id = Column(String(64), primary_key=True)
    learning_preference = Column(String(16), nullable=False, default="balanced")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QuizAttempt(Base):
    """知识点小测试记录，用于生成学习报告与薄弱点推荐。"""
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, default="default", index=True)
    node_id = Column(String(64), ForeignKey("kg_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    correct_count = Column(Integer, nullable=False, default=0)
    total_count = Column(Integer, nullable=False, default=1)
    accuracy = Column(Float, nullable=False, default=0.0)
    completed_at = Column(DateTime, default=datetime.utcnow, index=True)

    node = relationship("KGNode")


class QARecord(Base):
    __tablename__ = "qa_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, default="default", index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    context_nodes = Column(Text, nullable=True)  # JSON: 命中的节点 id 列表
    used_llm = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
