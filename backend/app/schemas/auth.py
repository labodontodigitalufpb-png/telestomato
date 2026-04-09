from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=3)
    email: EmailStr
    password: str = Field(..., min_length=6)
    age: int = Field(..., ge=18, le=120)
    sex: str = Field(..., min_length=1, max_length=20)
    address: str = Field(..., min_length=5, max_length=255)
    phone: str = Field(..., min_length=8, max_length=30)
    municipality: str = Field(..., min_length=2, max_length=150)
    state: str = Field(..., min_length=2, max_length=2)
    council_number: str = Field(..., min_length=2, max_length=50)
    has_specialization: bool = False
    specialization: str | None = None
    profession: str = Field(..., min_length=2, max_length=120)
    unit_name: str = Field(..., min_length=2, max_length=200)
    role: UserRole = UserRole.DENTIST

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class MeResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
