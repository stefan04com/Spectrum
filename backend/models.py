from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

CHILD_FK = "children.id"
PARENT_CHAT_SESSION_FK = "parent_chat_sessions.id"
RELATIONSHIP_CASCADE = "all, delete-orphan"

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(64), nullable=False, default="parent")

    children: Mapped[list["Child"]] = relationship("Child", back_populates="parent", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.id,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Child(Base, TimestampMixin):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    disability: Mapped[Optional[str]] = mapped_column(String(255))
    level: Mapped[str] = mapped_column(String(64), default="beginner")

    parent: Mapped[User] = relationship("User", back_populates="children")
    profile: Mapped[Optional["ChildProfile"]] = relationship("ChildProfile", back_populates="child", uselist=False, cascade=RELATIONSHIP_CASCADE)
    avatar: Mapped[Optional["Avatar"]] = relationship("Avatar", back_populates="child", uselist=False, cascade=RELATIONSHIP_CASCADE)
    events: Mapped[list["ChildEvent"]] = relationship("ChildEvent", back_populates="child", cascade=RELATIONSHIP_CASCADE)
    task_responses: Mapped[list["TaskEmotionLog"]] = relationship("TaskEmotionLog", back_populates="child", cascade=RELATIONSHIP_CASCADE)
    level_results: Mapped[list["LevelResultLog"]] = relationship("LevelResultLog", back_populates="child", cascade=RELATIONSHIP_CASCADE)
    alerts: Mapped[list["ParentAlert"]] = relationship("ParentAlert", back_populates="child", cascade=RELATIONSHIP_CASCADE)
    chat_sessions: Mapped[list["ParentChatSession"]] = relationship("ParentChatSession", back_populates="child", cascade=RELATIONSHIP_CASCADE)


    def to_dict(self, include_profile: bool = True, include_avatar: bool = True) -> Dict[str, Any]:
        data = {
            "child_id": self.id,
            "parent_id": self.parent_id,
            "name": self.name,
            "age": self.age,
            "disability": self.disability,
            "level": self.level,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        if include_profile:
            data["profile"] = self.profile.to_dict(self) if self.profile else None

        if include_avatar:
            data["avatar"] = self.avatar.to_dict() if self.avatar else None
            data["has_avatar"] = self.avatar is not None

        return data


class ChildProfile(Base, TimestampMixin):
    __tablename__ = "child_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id"), unique=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    guidance: Mapped[Optional[str]] = mapped_column(Text)
    traits: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)

    child: Mapped[Child] = relationship("Child", back_populates="profile")

    def to_dict(self, child: Optional[Child] = None) -> Dict[str, Any]:
        base_child = child or self.child
        return {
            "name": base_child.name if base_child else None,
            "age": base_child.age if base_child else None,
            "disability": base_child.disability if base_child else None,
            "notes": self.notes,
            "guidance": self.guidance,
            "traits": self.traits,
        }


class Avatar(Base, TimestampMixin):
    __tablename__ = "avatars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id"), unique=True)
    base_avatar: Mapped[str] = mapped_column(Text, nullable=False)
    emotions: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)

    child: Mapped[Child] = relationship("Child", back_populates="avatar")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "base_avatar": self.base_avatar,
            "emotions": self.emotions,
        }


class ChildEvent(Base):
    __tablename__ = "child_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("children.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    child: Mapped[Child] = relationship("Child", back_populates="events")


class ParentChatSession(Base, TimestampMixin):
    __tablename__ = "parent_chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey(CHILD_FK), index=True, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255))
    session_meta: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    child: Mapped[Child] = relationship("Child", back_populates="chat_sessions")
    messages: Mapped[list["ParentChatMessage"]] = relationship(
        "ParentChatMessage",
        back_populates="session",
        cascade=RELATIONSHIP_CASCADE,
        order_by="ParentChatMessage.created_at",
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.id,
            "child_id": self.child_id,
            "title": self.title,
            "meta": self.session_meta,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ParentChatMessage(Base, TimestampMixin):
    __tablename__ = "parent_chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey(PARENT_CHAT_SESSION_FK), index=True, nullable=False)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey(CHILD_FK), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_meta: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    session: Mapped[ParentChatSession] = relationship("ParentChatSession", back_populates="messages")
    child: Mapped[Child] = relationship("Child")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message_id": self.id,
            "session_id": self.session_id,
            "child_id": self.child_id,
            "role": self.role,
            "content": self.content,
            "meta": self.message_meta,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ParentGeneralChatSession(Base, TimestampMixin):
    __tablename__ = "parent_general_chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255))
    session_meta: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    messages: Mapped[list["ParentGeneralChatMessage"]] = relationship(
        "ParentGeneralChatMessage",
        back_populates="session",
        cascade=RELATIONSHIP_CASCADE,
        order_by="ParentGeneralChatMessage.created_at",
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.id,
            "parent_id": self.parent_id,
            "title": self.title,
            "meta": self.session_meta,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ParentGeneralChatMessage(Base, TimestampMixin):
    __tablename__ = "parent_general_chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("parent_general_chat_sessions.id"), index=True, nullable=False)
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_meta: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    session: Mapped[ParentGeneralChatSession] = relationship("ParentGeneralChatSession", back_populates="messages")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message_id": self.id,
            "session_id": self.session_id,
            "parent_id": self.parent_id,
            "role": self.role,
            "content": self.content,
            "meta": self.message_meta,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AdviceDoc(Base, TimestampMixin):
    __tablename__ = "advice_docs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[Optional[str]] = mapped_column(String(128))
    title: Mapped[Optional[str]] = mapped_column(String(255))
    advice: Mapped[Optional[str]] = mapped_column(Text)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "advice": self.advice,
        }


class ParentAlert(Base, TimestampMixin):
    __tablename__ = "parent_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey(CHILD_FK), index=True, nullable=False)
    reason: Mapped[str] = mapped_column(String(128), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    latest_log_id: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_log_id: Mapped[int] = mapped_column(Integer, nullable=False)

    child: Mapped[Child] = relationship("Child", back_populates="alerts")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "child_id": self.child_id,
            "reason": self.reason,
            "message": self.message,
            "payload": self.payload or {},
            "acknowledged": self.acknowledged,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TaskEmotionLog(Base, TimestampMixin):
    __tablename__ = "task_emotion_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey(CHILD_FK), index=True, nullable=False)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stress_level: Mapped[int] = mapped_column(Integer, nullable=False)
    emotion: Mapped[str] = mapped_column(String(64), nullable=False)

    child: Mapped[Child] = relationship("Child", back_populates="task_responses")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "child_id": self.child_id,
            "task_name": self.task_name,
            "stress_level": self.stress_level,
            "emotion": self.emotion,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class LevelResultLog(Base, TimestampMixin):
    __tablename__ = "level_result_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey(CHILD_FK), index=True, nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_answer: Mapped[str] = mapped_column(Text, nullable=False)
    child_answer: Mapped[str] = mapped_column(Text, nullable=False)

    child: Mapped[Child] = relationship("Child", back_populates="level_results")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "child_id": self.child_id,
            "level": self.level,
            "expected_answer": self.expected_answer,
            "child_answer": self.child_answer,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class SpeechButtonUsage(Base, TimestampMixin):
    __tablename__ = "speech_button_usage"
    __table_args__ = (
        UniqueConstraint("child_id", "button_key", name="uq_speech_button_usage_child_button"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(Integer, ForeignKey(CHILD_FK), index=True, nullable=False)
    button_key: Mapped[str] = mapped_column(String(160), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(160))
    category: Mapped[Optional[str]] = mapped_column(String(80))
    press_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "child_id": self.child_id,
            "button_key": self.button_key,
            "label": self.label,
            "category": self.category,
            "press_count": self.press_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
