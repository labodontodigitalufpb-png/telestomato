from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.case import ClinicalCase, RegulationStatus
from app.models.notification import NotificationType
from app.models.profile import ProfessionalProfile
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


def get_regulator_state(db: Session, user_id: int) -> str | None:
    profile = (
        db.query(ProfessionalProfile)
        .filter(ProfessionalProfile.user_id == user_id)
        .first()
    )
    if not profile or not profile.state:
        return None
    return profile.state.strip().upper()


def ensure_case_matches_regulator_state(case: ClinicalCase, regulator_state: str) -> None:
    case_state = (case.patient_state or case.dentist_state or "").strip().upper()
    if not case_state or case_state != regulator_state:
        raise HTTPException(
            status_code=403,
            detail=f"Caso fora da UF do telerregulador ({regulator_state}).",
        )


@router.get("/queue", response_model=list[CaseOut])
def regulation_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_regulator(current_user)
    query = db.query(ClinicalCase).filter(
        ClinicalCase.regulation_status.in_(
            [RegulationStatus.none, RegulationStatus.pending, RegulationStatus.in_review]
        )
    )

    if role_str(current_user) != "ADMIN":
        regulator_state = get_regulator_state(db, current_user.id)
        if not regulator_state:
            raise HTTPException(
                status_code=400,
                detail="Perfil do telerregulador sem UF definida. Atualize seu perfil profissional.",
            )
        query = query.filter(
            func.upper(
                func.coalesce(
                    func.nullif(func.trim(ClinicalCase.patient_state), ""),
                    func.nullif(func.trim(ClinicalCase.dentist_state), ""),
                    "",
                )
            )
            == regulator_state
        )

    return query.order_by(ClinicalCase.answered_at.desc().nullslast(), ClinicalCase.created_at.desc()).all()


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
    if case.regulation_status not in {RegulationStatus.none, RegulationStatus.pending, RegulationStatus.in_review}:
        raise HTTPException(status_code=400, detail="Caso não está disponível para telerregulação")
    if case.regulator_user_id not in {None, current_user.id}:
        raise HTTPException(status_code=403, detail="Caso regulado por outro usuário")

    if role_str(current_user) != "ADMIN":
        regulator_state = get_regulator_state(db, current_user.id)
        if not regulator_state:
            raise HTTPException(
                status_code=400,
                detail="Perfil do telerregulador sem UF definida. Atualize seu perfil profissional.",
            )
        ensure_case_matches_regulator_state(case, regulator_state)

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
    if case.regulation_status not in {
        RegulationStatus.none,
        RegulationStatus.pending,
        RegulationStatus.in_review,
        RegulationStatus.completed,
    }:
        raise HTTPException(status_code=400, detail="Caso não está disponível para conclusão regulatória")

    if role_str(current_user) != "ADMIN" and case.regulator_user_id not in {None, current_user.id}:
        raise HTTPException(status_code=403, detail="Caso regulado por outro usuário")

    if role_str(current_user) != "ADMIN":
        regulator_state = get_regulator_state(db, current_user.id)
        if not regulator_state:
            raise HTTPException(
                status_code=400,
                detail="Perfil do telerregulador sem UF definida. Atualize seu perfil profissional.",
            )
        ensure_case_matches_regulator_state(case, regulator_state)

    case.regulator_user_id = current_user.id
    case.regulation_status = payload.regulation_status
    case.regulation_notes = payload.regulation_notes
    case.microscopic_report_date = payload.microscopic_report_date
    case.followup_1m_head_neck_seen = payload.followup_1m_head_neck_seen
    case.followup_3m_initial_treatment_done = payload.followup_3m_initial_treatment_done
    case.followup_6m_status = payload.followup_6m_status
    case.followup_1y_status = payload.followup_1y_status
    case.followup_main_barriers = payload.followup_main_barriers
    case.regulated_at = datetime.utcnow()

    is_completed = payload.regulation_status == RegulationStatus.completed
    notification_title = (
        f"Telerregulação concluída no caso #{case.id}"
        if is_completed
        else f"Telerregulação atualizada no caso #{case.id}"
    )
    notification_body = (
        "A telerregulação foi concluída. Acesse o caso para revisar o desfecho final."
        if is_completed
        else "O telerregulador registrou uma atualização de acompanhamento. Acesse o caso para ver os detalhes."
    )

    notes_preview = (payload.regulation_notes or "").strip()
    if notes_preview:
        notification_body = f"{notification_body} Notas: {notes_preview[:140]}"

    notification_user_ids = {case.dentist_user_id}
    if case.assigned_to_user_id:
        notification_user_ids.add(case.assigned_to_user_id)

    for user_id in notification_user_ids:
        create_notification(
            db,
            user_id=user_id,
            title=notification_title,
            body=notification_body,
            notification_type=NotificationType.regulation_update,
            case_id=case.id,
        )

    db.commit()
    db.refresh(case)
    return case
