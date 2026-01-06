from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# NOT: Veritabanındaki 'users.id' VARCHAR(36).
# Bu yüzden tüm ilişkili ID'ler ve Referanslar String(36) olmak ZORUNDA.

# 1. SINIF TABLOSU
class ClassDB(Base):
    __tablename__ = "classes"

    id = Column(String(36), primary_key=True, index=True) # UUID Standardı
    name = Column(String(100), unique=True)
    
    # Users tablosuna bağlanıyor. Users.id VARCHAR(36) olduğu için bu da 36 olmalı.
    teacher_id = Column(String(36), ForeignKey("users.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # İlişkiler
    teacher = relationship("UserDB", back_populates="teaching_classes", foreign_keys=[teacher_id])
    students = relationship("UserDB", back_populates="student_class", foreign_keys="UserDB.class_id")

# 2. KULLANICILAR TABLOSU
class UserDB(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True) # Mevcut DB: VARCHAR(36)
    email = Column(String(255), unique=True, index=True)
    password_hash = Column(String(255))
    role = Column(String(50))
    first_name = Column(String(100))
    last_name = Column(String(100))
    
    # Classes.id tablosuna bağlanacak (String 36)
    class_id = Column(String(36), ForeignKey("classes.id"), nullable=True) 
    
    created_at = Column(DateTime, default=datetime.utcnow)

    student_class = relationship("ClassDB", back_populates="students", foreign_keys=[class_id])
    teaching_classes = relationship("ClassDB", back_populates="teacher", foreign_keys="ClassDB.teacher_id")

# 3. ÖĞRENCİ GÖNDERİLERİ
class SubmissionDB(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, index=True)
    student_id = Column(String(36), ForeignKey("users.id")) # FK: 36 Karakter
    activity_type = Column(String(50))
    content_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    evaluation = relationship("EvaluationDB", back_populates="submission", uselist=False)
    mistakes = relationship("MistakeDB", back_populates="submission")
    teacher_review = relationship("TeacherReviewDB", back_populates="submission", uselist=False)

# 4. AI DEĞERLENDİRME
class EvaluationDB(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(String(36), ForeignKey("submissions.id"), unique=True)
    score = Column(Integer)
    feedback_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    submission = relationship("SubmissionDB", back_populates="evaluation")

# 5. HATALAR
class MistakeDB(Base):
    __tablename__ = "mistakes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(String(36), ForeignKey("submissions.id"))
    error_type = Column(String(100))
    description = Column(Text)
    suggestion = Column(Text)

    submission = relationship("SubmissionDB", back_populates="mistakes")

# 6. ÖĞRETMEN YORUMLARI
class TeacherReviewDB(Base):
    __tablename__ = "teacher_reviews"

    id = Column(String(36), primary_key=True, index=True)
    submission_id = Column(String(36), ForeignKey("submissions.id"))
    teacher_id = Column(String(36), ForeignKey("users.id")) # FK: 36 Karakter
    new_score = Column(Integer)
    teacher_comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    submission = relationship("SubmissionDB", back_populates="teacher_review")

# 7. BİLDİRİMLER
class NotificationDB(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id")) # FK: 36 Karakter
    message = Column(String(500))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# 8. LOG SİSTEMİ
class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id")) # FK: 36 Karakter
    action = Column(String(100))
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

# 9. RUBRICS
class RubricDB(Base):
    __tablename__ = "rubrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    activity_type = Column(String(50))
    criteria = Column(String(255))
    description = Column(Text)
    max_score = Column(Integer)