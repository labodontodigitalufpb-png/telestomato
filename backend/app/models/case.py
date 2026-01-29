import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum
)
from sqlalchemy.orm import relationship

from app.core.db import Base


class CaseStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    assigned = "assigned"
    answered = "answered"
    closed = "closed"


class MediaType(str, enum.Enum):
    image = "image"
    exam = "exam"
    video = "video"
    consent = "consent"


class ClinicalCase(Base):
    __tablename__ = "clinical_cases"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dentist_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    dentist = relationship("User", foreign_keys=[dentist_user_id])

    # Snapshot mínimo (evita depender do profile para tudo)
    dentist_state = Column(String(2), nullable=True)
    dentist_municipality = Column(String(120), nullable=True)
    unit_name = Column(String(200), nullable=True)

    # Dados do paciente/caso (MVP)
    case_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    patient_name = Column(String(200), nullable=False)
    sus_card = Column(String(32), nullable=False)
    patient_phone = Column(String(32), nullable=True)
    patient_sex = Column(String(20), nullable=True)
    patient_age = Column(Integer, nullable=True)
    patient_city = Column(String(120), nullable=True)
    patient_state = Column(String(2), nullable=True)

    chief_complaint = Column(Text, nullable=True)
    hpi = Column(Text, nullable=True)  # história da doença atual
    medical_history = Column(Text, nullable=True)
    dental_history = Column(Text, nullable=True)
    habits = Column(Text, nullable=True)
    meds_history = Column(Text, nullable=True)
    vitals = Column(Text, nullable=True)  # texto simples no MVP
    oral_description = Column(Text, nullable=True)
    dentist_hypotheses = Column(Text, nullable=True)

    status = Column(Enum(CaseStatus), default=CaseStatus.draft, nullable=False, index=True)
    is_biopsied = Column(Boolean, default=False, nullable=False)

    media = relationship(
        "CaseMedia",
        back_populates="case",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Atribuição ao teleconsultor
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])

    submitted_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    answered_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

class CaseMedia(Base):
    __tablename__ = "case_media"

    id = Column(Integer, primary_key=True, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    case_id = Column(Integer, ForeignKey("clinical_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    case = relationship("ClinicalCase", back_populates="media")

    media_type = Column(Enum(MediaType), nullable=False, index=True)
    file_path = Column(Text, nullable=False)
    original_filename = Column(Text, nullable=True)
    content_type = Column(String(120), nullable=True)
