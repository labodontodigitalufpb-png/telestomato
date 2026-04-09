from datetime import datetime

from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.core.db import Base


class CaseMessage(Base):
    __tablename__ = "case_messages"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("clinical_cases.id"), nullable=False, index=True)
    author_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    message = Column(Text, nullable=False)

    case = relationship("ClinicalCase")
    author = relationship("User")
