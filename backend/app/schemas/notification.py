from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationType


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    case_id: int | None = None
    created_at: datetime
    read_at: datetime | None = None
    is_read: bool
    title: str
    body: str
    notification_type: NotificationType
