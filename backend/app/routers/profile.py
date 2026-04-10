from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.profile import ProfessionalProfile
from app.schemas.profile import ProfileCreate, ProfileOut
from app.security.auth import get_current_user   # ✅ AQUI
from app.models.user import User


router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=ProfileOut)
def get_my_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cadastro profissional não encontrado")
    return profile


@router.post("/me", response_model=ProfileOut)
def upsert_my_profile(payload: ProfileCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    if role == "TELECONSULTANT":
        if not payload.teleconsultant_state:
            raise HTTPException(status_code=400, detail="Teleconsultor precisa informar a UF de atuação.")
        if not payload.teleconsultant_certificate_url:
            raise HTTPException(status_code=400, detail="Teleconsultor precisa informar a URL do certificado.")

    profile = db.query(ProfessionalProfile).filter(ProfessionalProfile.user_id == current_user.id).first()
    if not profile:
        profile = ProfessionalProfile(user_id=current_user.id)
        db.add(profile)

    data = payload.dict()
    for k, v in data.items():
        setattr(profile, k, v)

    db.commit()
    db.refresh(profile)
    return profile
