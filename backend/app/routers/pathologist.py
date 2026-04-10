from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models.case import ClinicalCase, CaseStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.case import CaseOut
from app.schemas.pathologist import PathologyReportCreate, PathologyReportUpdate
from app.security.auth import get_current_user
from app.services.notifications import create_notification

router = APIRouter(prefix="/pathologist", tags=["pathologist"])


def role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def require_pathologist(user: User):
    if role_str(user) not in {"PATHOLOGIST", "ADMIN"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão: endpoint exclusivo para patologista",
        )


@router.get("/cases", response_model=list[CaseOut])
def list_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_pathologist(current_user)
    return (
        db.query(ClinicalCase)
        .options(selectinload(ClinicalCase.media))
        .filter(ClinicalCase.status != CaseStatus.draft)
        .order_by(ClinicalCase.patient_name.asc(), ClinicalCase.created_at.desc())
        .all()
    )


@router.get("/cases/{case_id}", response_model=CaseOut)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_pathologist(current_user)
    case = (
        db.query(ClinicalCase)
        .options(selectinload(ClinicalCase.media))
        .filter(ClinicalCase.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    if case.status == CaseStatus.draft:
        raise HTTPException(status_code=400, detail="Caso ainda está em rascunho e não pode ser analisado pela patologia")
    return case


@router.post("/cases/{case_id}/report", response_model=CaseOut)
def create_report(
    case_id: int,
    payload: PathologyReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_pathologist(current_user)
    case = (
        db.query(ClinicalCase)
        .options(selectinload(ClinicalCase.media))
        .filter(ClinicalCase.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    if case.status == CaseStatus.draft:
        raise HTTPException(status_code=400, detail="Caso ainda está em rascunho e não pode receber laudo histopatológico")

    case.pathologist_user_id = current_user.id
    case.pathology_diagnosis = payload.diagnosis.strip()
    case.pathology_report = payload.report.strip()
    case.pathology_reported_at = func.now()

    create_notification(
        db,
        user_id=case.dentist_user_id,
        title=f"Laudo histopatológico disponível para o caso #{case.id}",
        body="O patologista enviou o laudo histopatológico. Acesse o caso para visualizar o conteúdo completo.",
        notification_type=NotificationType.consultant_answer,
        case_id=case.id,
    )

    if case.assigned_to_user_id:
        create_notification(
            db,
            user_id=case.assigned_to_user_id,
            title=f"Laudo histopatológico disponível para o caso #{case.id}",
            body="O patologista enviou o laudo histopatológico do caso acompanhado.",
            notification_type=NotificationType.consultant_answer,
            case_id=case.id,
        )

    db.commit()
    db.refresh(case)
    return case


@router.put("/cases/{case_id}/report", response_model=CaseOut)
def update_report(
    case_id: int,
    payload: PathologyReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_pathologist(current_user)
    case = (
        db.query(ClinicalCase)
        .options(selectinload(ClinicalCase.media))
        .filter(ClinicalCase.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    if case.status == CaseStatus.draft:
        raise HTTPException(status_code=400, detail="Caso ainda está em rascunho e não pode receber laudo histopatológico")

    case.pathologist_user_id = current_user.id
    if payload.diagnosis:
        case.pathology_diagnosis = payload.diagnosis.strip()
    if payload.report:
        case.pathology_report = payload.report.strip()
    case.pathology_reported_at = func.now()

    create_notification(
        db,
        user_id=case.dentist_user_id,
        title=f"Laudo histopatológico atualizado no caso #{case.id}",
        body="O patologista atualizou o laudo histopatológico. Acesse o caso para visualizar o conteúdo atualizado.",
        notification_type=NotificationType.consultant_answer,
        case_id=case.id,
    )

    if case.assigned_to_user_id:
        create_notification(
            db,
            user_id=case.assigned_to_user_id,
            title=f"Laudo histopatológico atualizado no caso #{case.id}",
            body="O patologista atualizou o laudo histopatológico do caso acompanhado.",
            notification_type=NotificationType.consultant_answer,
            case_id=case.id,
        )

    db.commit()
    db.refresh(case)
    return case
