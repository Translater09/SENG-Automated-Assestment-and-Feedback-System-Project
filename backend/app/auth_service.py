import uuid
import hashlib
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .database import SessionLocal
from .db_models import UserDB
from .models import LoginRequest
from .storage import storage   # token storage


# ---------------- PASSWORD UTILS ----------------
def _hash_password(password: str) -> str:
    """
    Akademik proje için SHA-256 yeterli.
    (Prod ortamda bcrypt / argon2 kullanılır)
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


# ---------------- AUTH SERVICE ----------------
class AuthService:

    # -------- REGISTER --------
    def register(
        self,
        email: str,
        password: str,
        role: str,
        first_name: str = "Demo",
        last_name: str = "User"
    ):
        db: Session = SessionLocal()
        try:
            existing = db.query(UserDB).filter(UserDB.email == email).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already exists")

            user = UserDB(
                id=str(uuid.uuid4()),
                email=email,
                password_hash=_hash_password(password),
                role=role,
                first_name=first_name,
                last_name=last_name
            )

            db.add(user)
            db.commit()
            db.refresh(user)

            return {
                "id": user.id,
                "email": user.email,
                "role": user.role
            }

        finally:
            db.close()

    # -------- LOGIN --------
    def login(self, req: LoginRequest):
        db: Session = SessionLocal()
        try:
            user = db.query(UserDB).filter(UserDB.email == req.email).first()
            if not user:
                raise HTTPException(status_code=401, detail="Invalid credentials")

            if user.password_hash != _hash_password(req.password):
                raise HTTPException(status_code=401, detail="Invalid credentials")

            token = str(uuid.uuid4())
            storage.tokens[token] = user.id
            storage.save_data()

            return {
                "token": token,
                "role": user.role
            }

        finally:
            db.close()


# ---------------- TOKEN DEPENDENCY ----------------
def get_current_user(token: str):
    user_id = storage.tokens.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    db: Session = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    finally:
        db.close()


# ---------------- SINGLETON ----------------
auth_service = AuthService()
