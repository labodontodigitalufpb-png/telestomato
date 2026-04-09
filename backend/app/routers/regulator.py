from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.case import ClinicalCase, RegulationStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.case import CaseOut
from app.schemas.regulator import RegulationUpdate
from app.security.auth import get_current_user
from app.services.notifications import create_notification


router = APIRouter(prefix="/regulator", tags=["regulator"])


def role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def require_regulator(user: User) -> None:
    if role_str(user) not in {"REGULATOR", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint exclusivo para telerregulação",
        )


@router.get("/queue", response_model=list[CaseOut])
def regulation_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_regulator(current_user)
    return (
        db.query(ClinicalCase)
        .filter(ClinicalCase.regulation_status.in_([RegulationStatus.pending, RegulationStatus.in_review]))
        .order_by(ClinicalCase.answered_at.desc().nullslast(), ClinicalCase.created_at.desc())
        .all()
    )


@router.post("/cases/{case_id}/take", response_model=CaseOut)
def take_case_for_regulation(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_regulator(current_user)
    case = db.query(ClinicalCase).filter(ClinicalCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    if case.regulation_status not in {RegulationStatus.pending, RegulationStatus.in_review}:
        raise HTTPException(status_code=400, detail="Caso não está disponível para telerregulação")
    if case.regulator_user_id not in {None, current_user.id}:
        raise HTTPException(status_code=403, detail="Caso regulado por outro usuário")

    case.regulator_user_id = current_user.id
    case.regulation_status = RegulationStatus.in_review
    db.commit()
    db.refresh(case)
    return case


@router.post("/cases/{case_id}/complete", response_model=CaseOut)
def complete_regulation(
    case_id: int,
    payload: RegulationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_regulator(current_user)
    case = db.query(ClinicalCase).filter(ClinicalCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    if case.regulation_status not in {RegulationStatus.pending, RegulationStatus.in_review}:
        raise HTTPException(status_code=400, detail="Caso não está disponível para conclusão regulatória")

    if role_str(current_user) != "ADMIN" and case.regulator_user_id not in {None, current_user.id}:
        raise HTTPException(status_code=403, detail="Caso regulado por outro usuário")

    case.regulator_user_id = current_user.id
    case.regulation_status = payload.regulation_status
    case.regulation_notes = payload.regulation_notes
    case.regulated_at = datetime.utcnow()

    create_notification(
        db,
        user_id=case.dentist_user_id,
        title=f"Telerregulação atualizada no caso #{case.id}",
        body=payload.regulation_notes[:180],
        notification_type=NotificationType.regulation_update,
        case_id=case.id,
    )

    db.commit()
    db.refresh(case)
    return case
