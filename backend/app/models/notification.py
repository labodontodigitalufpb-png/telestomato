from datetime import datetime
import enum

from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship

from app.core.db import Base


class NotificationType(str, enum.Enum):
    consultant_answer = "consultant_answer"
    new_message = "new_message"
    regulation_update = "regulation_update"
    regulation_pending = "regulation_pending"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("clinical_cases.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    title = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType, name="notificationtype"), nullable=False)

    user = relationship("User")
    case = relationship("ClinicalCase")
