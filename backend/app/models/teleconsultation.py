from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.db import Base

class TeleconsultationAnswer(Base):
    __tablename__ = "teleconsultation_answers"

    id = Column(Integer, primary_key=True, index=True)

    case_id = Column(Integer, ForeignKey("clinical_cases.id"), nullable=False, index=True)
    case = relationship("ClinicalCase")

    consultant_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    consultant = relationship("User")

    diagnostic_opinion = Column(Text, nullable=False)
    conduct = Column(Text, nullable=False)
    care_coordination = Column(Text, nullable=False)
    references = Column(Text, nullable=True)

    answered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
