from fastapi import APIRouter, Depends, HTTPException
from .database import SessionLocal
from .analytics_service import get_repeated_mistakes
from .storage import storage
from fastapi import Query


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)

@router.get("/repeated-mistakes")
def repeated_mistakes(token: str):
    user_id = storage.tokens.get(token)

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = SessionLocal()
    data = get_repeated_mistakes(db, user_id)

    return {
        "student_id": user_id,
        "repeated_mistakes": data
    }


@router.get("/teacher/repeated-mistakes/{student_id}")
def teacher_repeated_mistakes(
    student_id: str,
    token: str = Query(...)
):
    teacher_id = storage.tokens.get(token)

    if not teacher_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = SessionLocal()
    data = get_repeated_mistakes(db, student_id)

    return {
        "student_id": student_id,
        "repeated_mistakes": data
    }
    
