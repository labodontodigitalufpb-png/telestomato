from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.case import ClinicalCase
from app.models.message import CaseMessage
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.message import CaseMessageCreate, CaseMessageOut
from app.security.auth import get_current_user
from app.services.notifications import create_notifications_for_users


router = APIRouter(prefix="/cases", tags=["messages"])


def role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def can_access_case(case: ClinicalCase, user: User) -> bool:
    role = role_str(user)
    if role == "ADMIN":
        return True
    if case.dentist_user_id == user.id:
        return True
    if case.assigned_to_user_id == user.id:
        return True
    if case.regulator_user_id == user.id:
        return True
    return False


@router.get("/{case_id}/messages", response_model=list[CaseMessageOut])
def list_case_messages(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(ClinicalCase).filter(ClinicalCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    if not can_access_case(case, current_user):
        raise HTTPException(status_code=403, detail="Sem permissão para acessar o chat deste caso")

    return (
        db.query(CaseMessage)
        .filter(CaseMessage.case_id == case_id)
        .order_by(CaseMessage.created_at.asc())
        .all()
    )


@router.post("/{case_id}/messages", response_model=CaseMessageOut)
def create_case_message(
    case_id: int,
    payload: CaseMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(ClinicalCase).filter(ClinicalCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    if not can_access_case(case, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para enviar mensagem neste caso")

    message = CaseMessage(
        case_id=case_id,
        author_user_id=current_user.id,
        message=payload.message.strip(),
    )
    db.add(message)
    db.flush()

    recipients = [
        case.dentist_user_id,
        case.assigned_to_user_id,
        case.regulator_user_id,
    ]
    create_notifications_for_users(
        db,
        user_ids=[user_id for user_id in recipients if user_id and user_id != current_user.id],
        title=f"Nova mensagem no caso #{case.id}",
        body=payload.message.strip()[:180],
        notification_type=NotificationType.new_message,
        case_id=case.id,
    )

    db.commit()
    db.refresh(message)
    return message
