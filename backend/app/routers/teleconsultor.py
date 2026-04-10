from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from app.core.db import get_db
from app.security.auth import get_current_user
from app.models.user import User
from app.models.case import ClinicalCase, CaseStatus
from app.models.case import RegulationStatus
from app.models.notification import NotificationType
from app.schemas.case import CaseOut
from app.schemas.teleconsultor import ConsultantAnswerCreate
from app.services.notifications import create_notification, create_notifications_for_users, get_active_regulator_ids

router = APIRouter(prefix="/teleconsultor", tags=["teleconsultor"])


def role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def require_teleconsultor(user: User):
    role = role_str(user)
    if role not in ["TELECONSULTANT", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão: endpoint exclusivo para teleconsultor",
        )


@router.get("/my-cases", response_model=List[CaseOut])
def my_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_teleconsultor(current_user)

    q = (
        db.query(ClinicalCase)
        .options(selectinload(ClinicalCase.media))
        .filter(ClinicalCase.assigned_to_user_id == current_user.id)
        .order_by(ClinicalCase.assigned_at.desc().nullslast(), ClinicalCase.created_at.desc())
    )
    return q.all()


@router.post("/next", response_model=Optional[CaseOut])
def next_case(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pega o próximo caso da fila (status=submitted), atribui ao teleconsultor logado
    e muda status para 'assigned'.
    """
    require_teleconsultor(current_user)

    case = (
        db.query(ClinicalCase)
        .options(selectinload(ClinicalCase.media))
        .filter(ClinicalCase.status == CaseStatus.submitted)
        .filter(ClinicalCase.assigned_to_user_id.is_(None))
        .order_by(ClinicalCase.submitted_at.asc().nullslast(), ClinicalCase.created_at.asc())
        .first()
    )

    if not case:
        return None

    case.assigned_to_user_id = current_user.id
    case.assigned_at = func.now()
    case.status = CaseStatus.assigned

    db.commit()
    db.refresh(case)
    return case


@router.post("/cases/{case_id}/answer", response_model=CaseOut)
def answer_case(
    case_id: int,
    payload: ConsultantAnswerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Teleconsultor responde um caso atribuído.
    Salva:
    - descrição clínica (consultant_summary)
    - hipóteses justificadas (consultant_hypotheses)
    - conduta clínica (consultant_conduct)
    - coordenação do cuidado (consultant_care_coordination)
    - bibliografia (consultant_bibliography)
    + opcional: hipótese principal curta (consultant_hypothesis)
    + opcional: malignidade (consultant_is_malignant)
    """
    require_teleconsultor(current_user)

    case = (
        db.query(ClinicalCase)
        .options(selectinload(ClinicalCase.media))
        .filter(ClinicalCase.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")

    # só responde se for o teleconsultor atribuído (ou ADMIN)
    if role_str(current_user) != "ADMIN":
        if case.assigned_to_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Caso não está atribuído a você")
        if case.status not in [CaseStatus.assigned, CaseStatus.answered]:
            raise HTTPException(status_code=400, detail=f"Caso em status inválido: {case.status.value}")

    # ---- grava nos campos (exigem existir no modelo/tabela) ----
    case.consultant_summary = payload.clinical_description
    case.consultant_hypotheses = payload.justified_hypotheses
    case.consultant_conduct = payload.clinical_conduct
    case.consultant_care_coordination = payload.care_coordination
    case.consultant_bibliography = payload.bibliography

    if payload.consultant_is_malignant is not None:
        case.consultant_is_malignant = payload.consultant_is_malignant

    if payload.consultant_hypothesis:
        # hipótese principal curta (se você usa esse campo)
        case.consultant_hypothesis = payload.consultant_hypothesis

    if case.consultant_is_malignant:
        case.regulation_status = RegulationStatus.pending
    else:
        case.regulation_status = RegulationStatus.none
        case.regulator_user_id = None
        case.regulation_notes = None

    create_notification(
        db,
        user_id=case.dentist_user_id,
        title=f"Resposta disponível para o caso #{case.id}",
        body="A teleconsultoria respondeu o caso. Acesse os detalhes para visualizar a conduta.",
        notification_type=NotificationType.consultant_answer,
        case_id=case.id,
    )

    if case.consultant_is_malignant:
        create_notifications_for_users(
            db,
            user_ids=get_active_regulator_ids(db),
            title=f"Caso suspeito aguardando telerregulação #{case.id}",
            body="Um caso sinalizado como suspeito de malignidade entrou na fila de telerregulação.",
            notification_type=NotificationType.regulation_pending,
            case_id=case.id,
        )

    case.answered_at = func.now()
    case.status = CaseStatus.answered

    db.commit()
    db.refresh(case)
    return case
