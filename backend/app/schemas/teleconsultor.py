from typing import Optional
from pydantic import BaseModel, Field

class ConsultantAnswerCreate(BaseModel):
    clinical_description: str = Field(..., min_length=3)
    justified_hypotheses: str = Field(..., min_length=3)
    clinical_conduct: str = Field(..., min_length=3)
    care_coordination: str = Field(..., min_length=3)
    bibliography: Optional[str] = None

    consultant_hypothesis: Optional[str] = None
    consultant_is_malignant: Optional[bool] = None
