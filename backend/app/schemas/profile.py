
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional

class ProfileBase(BaseModel):
    full_name: str
    age: int
    sex: str
    phone: str
    email: EmailStr
    municipality: str
    state: str
    cro: str
    unit_name: str
    years_experience: int
    has_specialization: bool = False
    specialization: Optional[str] = None
    teleconsultant_state: Optional[str] = None
    teleconsultant_certificate_url: Optional[str] = None

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str):
        v = v.strip().upper()
        if len(v) != 2:
            raise ValueError("state deve ser UF com 2 letras (ex: PB, SP)")
        return v

    @field_validator("teleconsultant_state")
    @classmethod
    def validate_tc_state(cls, v: Optional[str]):
        if v is None:
            return v
        v = v.strip().upper()
        if len(v) != 2:
            raise ValueError("teleconsultant_state deve ser UF com 2 letras")
        return v

class ProfileCreate(ProfileBase):
    pass

class ProfileOut(ProfileBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

