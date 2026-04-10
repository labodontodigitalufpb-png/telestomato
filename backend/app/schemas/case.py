from datetime import date, datetime
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


class CaseUpdate(BaseModel):
    dentist_state: str | None = None
    dentist_municipality: str | None = None
    unit_name: str | None = None

    patient_name: str | None = None
    sus_card: str | None = None
    patient_phone: str | None = None
    patient_sex: str | None = None
    patient_age: int | None = None
    patient_city: str | None = None
    patient_state: str | None = None

    chief_complaint: str | None = None
    hpi: str | None = None
    medical_history: str | None = None
    dental_history: str | None = None
    habits: str | None = None
    meds_history: str | None = None
    vitals: str | None = None
    oral_description: str | None = None
    dentist_hypotheses: str | None = None

    lesion_topography: str | None = None
    is_biopsied: bool | None = None


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uploaded_at: datetime
    uploader_user_id: int | None = None
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
    microscopic_report_date: date | None = None
    followup_1m_head_neck_seen: bool | None = None
    followup_3m_initial_treatment_done: bool | None = None
    followup_6m_status: str | None = None
    followup_1y_status: str | None = None
    followup_main_barriers: str | None = None
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
