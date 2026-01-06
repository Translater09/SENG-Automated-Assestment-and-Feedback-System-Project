# app/lms_service.py
from .storage import storage


class LMSService:
    def sync_grade(self, student_id: str, submission_id: str, score: int) -> str:
        storage.log(
            student_id,
            "sync_grade_lms",
            {"submission_id": submission_id, "score": score},
        )
        return "Grade synced to LMS (simulated)."


lms_service = LMSService()
