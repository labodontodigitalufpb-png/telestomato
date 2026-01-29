from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict
from app.models.case import CaseStatus, MediaType




class CaseCreate(BaseModel):
    dentist_state: Optional[str] = None
    dentist_municipality: Optional[str] = None
    unit_name: Optional[str] = None

    patient_name: str
    sus_card: str
class CaseCreate(BaseModel):
    patient_name: str
    sus_card: str
    patient_phone: Optional[str] = None
    patient_sex: Optional[str] = None
    patient_age: Optional[int] = None
    patient_city: Optional[str] = None
    patient_state: Optional[str] = None

    chief_complaint: Optional[str] = None
    hpi: Optional[str] = None
    medical_history: Optional[str] = None
    dental_history: Optional[str] = None
    habits: Optional[str] = None
    meds_history: Optional[str] = None
    vitals: Optional[str] = None
    oral_description: Optional[str] = None
    dentist_hypotheses: Optional[str] = None


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uploaded_at: datetime
    media_type: MediaType
    file_path: str
    original_filename: Optional[str] = None
    content_type: Optional[str] = None


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    status: CaseStatus

    dentist_state: Optional[str] = None
    dentist_municipality: Optional[str] = None
    unit_name: Optional[str] = None

    patient_name: str
    sus_card: str
    patient_phone: Optional[str] = None
    patient_sex: Optional[str] = None
    patient_age: Optional[int] = None
    patient_city: Optional[str] = None
    patient_state: Optional[str] = None

    chief_complaint: Optional[str] = None
    hpi: Optional[str] = None
    medical_history: Optional[str] = None
    dental_history: Optional[str] = None
    habits: Optional[str] = None
    meds_history: Optional[str] = None
    vitals: Optional[str] = None
    oral_description: Optional[str] = None
    dentist_hypotheses: Optional[str] = None

    media: List[MediaOut] = []
