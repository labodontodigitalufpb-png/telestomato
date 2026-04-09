from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, Field

from app.models.case import CaseStatus, RegulationStatus
from app.models.media import MediaType


class CaseCreate(BaseModel):
    # Dentista/unidade (OBRIGATÓRIO)
    dentist_state: str
    dentist_municipality: str
    unit_name: str

    # Paciente (OBRIGATÓRIO)
    patient_name: str
    sus_card: str
    patient_phone: str
    patient_sex: str
    patient_age: int
    patient_city: str
    patient_state: str

    # Anamnese / caso (OBRIGATÓRIO)
    chief_complaint: str
    hpi: str
    medical_history: str
    dental_history: str
    habits: str
    meds_history: str
    vitals: str
    oral_description: str
    dentist_hypotheses: str

    # Dashboard / extras (OBRIGATÓRIO)
    lesion_topography: str
    is_biopsied: bool


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uploaded_at: datetime
    media_type: MediaType
    file_path: str
    original_filename: str | None = None
    content_type: str | None = None


class CaseOutPublic(BaseModel):
    """Resposta enxuta (ideal para POST /cases)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    status: CaseStatus

    dentist_state: str
    dentist_municipality: str
    unit_name: str

    patient_name: str
    sus_card: str
    patient_phone: str
    patient_sex: str
    patient_age: int
    patient_city: str
    patient_state: str

    chief_complaint: str
    hpi: str
    medical_history: str
    dental_history: str
    habits: str
    meds_history: str
    vitals: str
    oral_description: str
    dentist_hypotheses: str

    lesion_topography: str
    is_biopsied: bool

    media: List[MediaOut] = Field(default_factory=list)


class CaseOut(BaseModel):
    """Resposta completa (teleconsultor/admin)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    status: CaseStatus

    dentist_state: str
    dentist_municipality: str
    unit_name: str

    patient_name: str
    sus_card: str
    patient_phone: str
    patient_sex: str
    patient_age: int
    patient_city: str
    patient_state: str

    chief_complaint: str
    hpi: str
    medical_history: str
    dental_history: str
    habits: str
    meds_history: str
    vitals: str
    oral_description: str
    dentist_hypotheses: str

    lesion_topography: str
    is_biopsied: bool

    # Teleconsultoria (podem ser None até responder)
    consultant_summary: str | None = None
    consultant_hypotheses: str | None = None
    consultant_conduct: str | None = None
    consultant_care_coordination: str | None = None
    consultant_bibliography: str | None = None
    consultant_hypothesis: str | None = None
    consultant_is_malignant: bool | None = None

    assigned_to_user_id: int | None = None
    pathologist_user_id: int | None = None
    regulator_user_id: int | None = None
    regulation_status: RegulationStatus | None = None
    regulation_notes: str | None = None
    pathology_diagnosis: str | None = None
    pathology_report: str | None = None
    submitted_at: datetime | None = None
    assigned_at: datetime | None = None
    answered_at: datetime | None = None
    pathology_reported_at: datetime | None = None
    regulated_at: datetime | None = None
    closed_at: datetime | None = None

    media: List[MediaOut] = Field(default_factory=list)


class ConsultantAnswerCreate(BaseModel):
    clinical_description: str
    justified_hypotheses: str
    clinical_conduct: str
    care_coordination: str
    bibliography: str | None = None
    consultant_is_malignant: bool | None = None
