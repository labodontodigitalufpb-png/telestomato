from datetime import datetime

from pydantic import BaseModel, Field

from app.models.case import RegulationStatus


class RegulationUpdate(BaseModel):
    regulation_notes: str = Field(..., min_length=3)
    regulation_status: RegulationStatus = RegulationStatus.completed


class RegulationQueueItem(BaseModel):
    id: int
    patient_name: str
    consultant_hypothesis: str | None = None
    consultant_is_malignant: bool
    regulation_status: RegulationStatus
    answered_at: datetime | None = None
