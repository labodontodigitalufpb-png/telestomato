from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.db import get_db
from app.models.profile import ProfessionalProfile
from app.models.user import User, UserRole, ApprovalStatus
from app.schemas.auth import MeResponse, RegisterRequest, Token

from app.security.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_and_upgrade_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

PUBLIC_REGISTER_ROLES = {
    UserRole.DENTIST,
    UserRole.TELECONSULTANT,
    UserRole.PATHOLOGIST,
    UserRole.REGULATOR,
}


def role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


@router.post("/register", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma conta com este e-mail",
        )

    requested_role = payload.role
    if requested_role not in PUBLIC_REGISTER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Perfil não permitido no cadastro público",
        )

    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        phone=payload.phone.strip(),
        password_hash=hash_password(payload.password),
        role=requested_role,
        is_active=True,
        approval_status=ApprovalStatus.approved,
        approved_at=func.now(),
    )
    db.add(user)
    db.flush()

    profile = ProfessionalProfile(
        user_id=user.id,
        full_name=payload.full_name.strip(),
        age=payload.age,
        sex=payload.sex.strip(),
        phone=payload.phone.strip(),
        email=email,
        address=payload.address.strip(),
        profession=payload.profession.strip(),
        municipality=payload.municipality.strip(),
        state=payload.state.strip().upper(),
        cro=payload.council_number.strip(),
        unit_name=payload.unit_name.strip(),
        years_experience=0,
        has_specialization=payload.has_specialization,
        specialization=(payload.specialization or "").strip() or None,
        teleconsultant_state=None,
        teleconsultant_certificate_url=None,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    return MeResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
    )


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = (form_data.username or "").strip().lower()
    password = form_data.password or ""

    user = db.query(User).filter(User.email == email).first()

    # Se quiser debug SEM risco de 500, deixe assim:
    # print("LOGIN email:", email, "user?", bool(user), "active?", getattr(user, "is_active", None))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    # ✅ Verifica senha com proteção do bcrypt (72 bytes) e faz upgrade para argon2 se necessário
    if not verify_and_upgrade_password(db, user, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    return MeResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=role,
    )
