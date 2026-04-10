from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.models.case import ClinicalCase
from app.core.db import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.security.auth import get_current_user


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/mine", response_model=list[NotificationOut])
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .options(selectinload(Notification.case))
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [
        NotificationOut.model_validate(
            {
                "id": item.id,
                "user_id": item.user_id,
                "case_id": item.case_id,
                "created_at": item.created_at,
                "read_at": item.read_at,
                "is_read": item.is_read,
                "title": item.title,
                "body": item.body,
                "notification_type": item.notification_type,
                "patient_name": item.case.patient_name if item.case else None,
            }
        )
        for item in notifications
    ]


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .options(selectinload(Notification.case))
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()
    db.refresh(notification)
    case = db.query(ClinicalCase).filter(ClinicalCase.id == notification.case_id).first() if notification.case_id else None
    return NotificationOut.model_validate(
        {
            "id": notification.id,
            "user_id": notification.user_id,
            "case_id": notification.case_id,
            "created_at": notification.created_at,
            "read_at": notification.read_at,
            "is_read": notification.is_read,
            "title": notification.title,
            "body": notification.body,
            "notification_type": notification.notification_type,
            "patient_name": case.patient_name if case else None,
        }
    )
