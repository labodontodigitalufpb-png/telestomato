from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.security.auth import get_current_user
from app.models.user import User
from app.models.case import ClinicalCase, CaseStatus
from app.schemas.case import CaseCreate, CaseOut

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseOut)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = ClinicalCase(
        dentist_user_id=current_user.id,
        status=CaseStatus.draft,
        **payload.model_dump(),
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.get("/mine", response_model=list[CaseOut])
def list_my_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ClinicalCase)
        .filter(ClinicalCase.dentist_user_id == current_user.id)
        .order_by(ClinicalCase.created_at.desc())
        .all()
    )


@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(ClinicalCase).filter(ClinicalCase.id == case_id).first()
    if not case:
        raise HTTPException(404, "Caso não encontrado")
    if case.dentist_user_id != current_user.id:
        raise HTTPException(403, "Sem permissão para ver este caso")
    return case


@router.post("/{case_id}/submit", response_model=CaseOut)
def submit_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(ClinicalCase).filter(ClinicalCase.id == case_id).first()
    if not case:
        raise HTTPException(404, "Caso não encontrado")
    if case.dentist_user_id != current_user.id:
        raise HTTPException(403, "Sem permissão para enviar este caso")

    case.status = CaseStatus.submitted
    db.commit()
    db.refresh(case)
    return case
