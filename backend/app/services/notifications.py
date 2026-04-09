from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole


def create_notification(
    db: Session,
    *,
    user_id: int,
    title: str,
    body: str,
    notification_type: NotificationType,
    case_id: int | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        case_id=case_id,
        title=title,
        body=body,
        notification_type=notification_type,
    )
    db.add(notification)
    db.flush()
    return notification


def create_notifications_for_users(
    db: Session,
    *,
    user_ids: Iterable[int],
    title: str,
    body: str,
    notification_type: NotificationType,
    case_id: int | None = None,
) -> None:
    seen = set()
    for user_id in user_ids:
        if user_id in seen:
            continue
        seen.add(user_id)
        create_notification(
            db,
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
            case_id=case_id,
        )


def get_active_regulator_ids(db: Session) -> list[int]:
    rows = (
        db.query(User.id)
        .filter(User.role == UserRole.REGULATOR)
        .filter(User.is_active.is_(True))
        .all()
    )
    return [user_id for (user_id,) in rows]
