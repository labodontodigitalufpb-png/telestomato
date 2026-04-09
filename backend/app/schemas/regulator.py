from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.case import RegulationStatus


class RegulationUpdate(BaseModel):
    regulation_notes: str = Field(..., min_length=3)
    regulation_status: RegulationStatus = RegulationStatus.completed
    microscopic_report_date: date | None = None
    followup_1m_head_neck_seen: bool | None = None
    followup_3m_initial_treatment_done: bool | None = None
    followup_6m_status: str | None = Field(default=None, min_length=3)
    followup_main_barriers: str | None = Field(default=None, min_length=3)

    @model_validator(mode="after")
    def validate_completed_followup(self):
        if self.regulation_status != RegulationStatus.completed:
            return self

        missing = []
        if self.microscopic_report_date is None:
            missing.append("data do laudo microscopico")
        if self.followup_1m_head_neck_seen is None:
            missing.append("follow-up de 1 mes (cirurgiao de cabeca e pescoco)")
        if self.followup_3m_initial_treatment_done is None:
            missing.append("follow-up de 3 meses (tratamento inicial)")
        if not self.followup_6m_status:
            missing.append("follow-up de 6 meses")
        if not self.followup_main_barriers:
            missing.append("principais barreiras")

        if missing:
            raise ValueError(
                "Para concluir a regulacao, preencha: " + ", ".join(missing) + "."
            )

        return self


class RegulationQueueItem(BaseModel):
    id: int
    patient_name: str
    consultant_hypothesis: str | None = None
    consultant_is_malignant: bool
    regulation_status: RegulationStatus
    answered_at: datetime | None = None
