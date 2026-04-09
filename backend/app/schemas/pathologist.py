from pydantic import BaseModel, Field


class PathologyReportCreate(BaseModel):
    diagnosis: str = Field(..., min_length=3)
    report: str = Field(..., min_length=3)
