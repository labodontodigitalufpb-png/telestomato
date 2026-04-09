import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Enum,
)
from sqlalchemy.orm import relationship

from app.core.db import Base


class CaseStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    assigned = "assigned"
    answered = "answered"
    closed = "closed"


class RegulationStatus(str, enum.Enum):
    none = "none"
    pending = "pending"
    in_review = "in_review"
    completed = "completed"


class ClinicalCase(Base):
    __tablename__ = "clinical_cases"

    # ---- Identificação ----
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # ---- Dentista ----
    dentist_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    dentist = relationship("User", foreign_keys=[dentist_user_id])

    dentist_state = Column(String(2), nullable=False)
    dentist_municipality = Column(String(120), nullable=False)
    unit_name = Column(String(200), nullable=False)

    # ---- Paciente ----
    case_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    patient_name = Column(String(200), nullable=False)
    sus_card = Column(String(32), nullable=False)
    patient_phone = Column(String(32), nullable=False)
    patient_sex = Column(String(20), nullable=False)
    patient_age = Column(Integer, nullable=False)
    patient_city = Column(String(120), nullable=False)
    patient_state = Column(String(2), nullable=False)

    # ---- Anamnese / exame ----
    chief_complaint = Column(Text, nullable=False)
    hpi = Column(Text, nullable=False)
    medical_history = Column(Text, nullable=False)
    dental_history = Column(Text, nullable=False)
    habits = Column(Text, nullable=False)
    meds_history = Column(Text, nullable=False)
    vitals = Column(Text, nullable=False)
    oral_description = Column(Text, nullable=False)

    # ---- Hipóteses do dentista ----
    dentist_hypotheses = Column(Text, nullable=False)

    # ---- Campos estruturados (dashboard) ----
    lesion_topography = Column(String(120), nullable=False)

    # ---- Teleconsultoria (preenchidos depois) ----
    consultant_summary = Column(Text, nullable=True)
    consultant_hypotheses = Column(Text, nullable=True)
    consultant_conduct = Column(Text, nullable=True)
    consultant_care_coordination = Column(Text, nullable=True)
    consultant_bibliography = Column(Text, nullable=True)

    consultant_hypothesis = Column(String(200), nullable=True)
    consultant_is_malignant = Column(Boolean, default=False, nullable=False)

    # ---- Status e fluxo ----
    status = Column(
        Enum(CaseStatus, name="casestatus"),
        default=CaseStatus.draft,
        nullable=False,
        index=True,
    )

    is_biopsied = Column(Boolean, default=False, nullable=False)

    # ---- Atribuição ao teleconsultor ----
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])
    pathologist_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    pathologist = relationship("User", foreign_keys=[pathologist_user_id])
    regulator_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    regulator = relationship("User", foreign_keys=[regulator_user_id])

    pathology_diagnosis = Column(Text, nullable=True)
    pathology_report = Column(Text, nullable=True)
    pathology_reported_at = Column(DateTime, nullable=True)

    regulation_status = Column(
        Enum(RegulationStatus, name="regulationstatus"),
        default=RegulationStatus.none,
        nullable=False,
        index=True,
    )
    regulation_notes = Column(Text, nullable=True)

    submitted_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    answered_at = Column(DateTime, nullable=True)
    regulated_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    # ---- Mídias ----
    media = relationship(
        "CaseMedia",
        back_populates="case",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
