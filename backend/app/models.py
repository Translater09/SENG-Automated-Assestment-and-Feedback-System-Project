from pydantic import BaseModel
from typing import List, Dict, Optional
from enum import Enum
from datetime import datetime


class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class SubmissionType(str, Enum):
    SPEAKING = "speaking"
    WRITING = "writing"
    QUIZ = "quiz"


class User(BaseModel):
    id: str
    email: str
    password: str
    role: UserRole
    first_name: str
    last_name: str


class EvaluationResult(BaseModel):
    id: str
    submission_id: str
    score: int
    feedback_text: str
    weaknesses: str
    created_at: datetime


class Mistake(BaseModel):
    id: str
    submission_id: str
    error_type: str
    description: str
    suggestion: str


class Submission(BaseModel):
    id: str
    student_id: str
    activity_type: SubmissionType
    content_text: Optional[str] = None
    created_at: datetime


# ==========================
# MCQ QUIZ MODELLERİ
# ==========================
class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_answer: str


class Quiz(BaseModel):
    id: str
    student_id: str
    difficulty: str
    questions: List[QuizQuestion]
    created_at: datetime
class QuizSubmitRequest(BaseModel):
    quiz_id: str
    answers: Dict[str, str]  # question_id -> chosen_option


class LoginRequest(BaseModel):
    email: str
    password: str


class ReviewRequest(BaseModel):
    new_score: int
    teacher_comment: str
class TokenResponse(BaseModel):
    token: str
    role: UserRole
