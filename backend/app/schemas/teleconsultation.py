from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AnswerCreate(BaseModel):
    diagnostic_opinion: str
    conduct: str
    care_coordination: str
    references: Optional[str] = None

class AnswerOut(AnswerCreate):
    id: int
    case_id: int
    consultant_user_id: int
    answered_at: datetime

    class Config:
        from_attributes = True
