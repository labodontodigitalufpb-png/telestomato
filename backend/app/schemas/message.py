from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CaseMessageCreate(BaseModel):
    message: str = Field(..., min_length=2)


class CaseMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    author_user_id: int
    created_at: datetime
    message: str
