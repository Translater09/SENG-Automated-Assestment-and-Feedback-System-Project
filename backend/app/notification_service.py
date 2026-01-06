# app/notification_service.py
from datetime import datetime

from .models import Notification
from .storage import storage


class NotificationService:
    def notify(self, user_id: str, message: str):
        note = Notification(
            id=str(datetime.utcnow().timestamp()).replace(".", ""),
            user_id=user_id,
            message=message,
            created_at=datetime.utcnow(),
        )
        storage.notifications[note.id] = note
        storage.log(user_id, "notify", {"message": message})


notification_service = NotificationService()
