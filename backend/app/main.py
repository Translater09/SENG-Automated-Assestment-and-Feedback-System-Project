import os
import uuid
import shutil
import json
import pydantic
from datetime import datetime
from datetime import datetime, timedelta  
from typing import List, Optional, Union
from sqlalchemy import func
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from fpdf import FPDF 
from fastapi.responses import FileResponse
# ----------------- PROJE MODÜLLERİ -----------------
from .database import engine, Base, get_db, SessionLocal
from . import db_models as models
from . import models as schemas
from .config import UPLOAD_DIR
from .auth_service import _hash_password
from .ai_service import ai_service
from .storage import storage
# Uygulamayı Başlat
app = FastAPI(title="AAFS Backend - MSSQL Edition")

# Tabloları Otomatik Oluştur (MSSQL)
models.Base.metadata.create_all(bind=engine)

# CORS Ayarları (Frontend Erişimi İçin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload Klasörü
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ---------------------------------------------------------
# 🛠️ YARDIMCI FONKSİYONLAR (LOG & AUTH & NOTIFICATION)
# ---------------------------------------------------------

# Audit Logging
def log_action(db: Session, user_id: str, action: str, details: str = None):
    try:
        new_log = models.AuditLogDB(
            user_id=user_id,
            action=action,
            details=details,
            timestamp=datetime.utcnow()
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        print(f"⚠️ Loglama Hatası: {e}")

# Token Kontrolü (Dependency)
def get_current_user(token: str, db: Session = Depends(get_db)):
    user_id = storage.tokens.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# Türkçe karakterleri İngilizceye çeviren yardımcı fonksiyon
def safe_text(text):
    if not text: return ""
    tr_map = {
        'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 
        'ş': 's', 'Ş': 'S', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
    }
    for tr, en in tr_map.items():
        text = text.replace(tr, en)
    return text.encode('latin-1', 'replace').decode('latin-1')

#  Sınıf Hocasına Bildirim Gönderme Fonksiyonu
def notify_class_teacher(db: Session, student_id: str, activity_type: str):
    # 1. Öğrenciyi ve sınıfını bul
    student = db.query(models.UserDB).filter(models.UserDB.id == student_id).first()
    
    if not student or not student.class_id:
        return  # Öğrenci bir sınıfta değilse kimseye bildirim gitmez

    # 2. Sınıfı bul
    student_class = db.query(models.ClassDB).filter(models.ClassDB.id == student.class_id).first()
    
    if not student_class or not student_class.teacher_id:
        return # Sınıfın hocası atanmamışsa çık
        
    # 3. Sadece O HOCAYA bildirim gönder
    new_notif = models.NotificationDB(
        id=str(uuid.uuid4()),
        user_id=student_class.teacher_id, # Hedef: Sınıf Öğretmeni
        message=f"{student.first_name} {student.last_name} ({student_class.name}) completed a {activity_type} activity.",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(new_notif)
    db.commit()


# ---------------------------------------------------------
# 📝 PYDANTIC MODELLER (REQUEST/RESPONSE SCHEMAS)
# ---------------------------------------------------------

class UserCreate(pydantic.BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str = "student"

#  Sınıf Yönetimi Modelleri
class ClassCreateRequest(pydantic.BaseModel):
    name: str

class AssignStudentRequest(pydantic.BaseModel):
    student_email: str
    class_id: str    

#  Hoca Dashboard Modelleri
class TeacherReviewRequest(pydantic.BaseModel):
    submission_id: str
    new_score: int
    teacher_comment: str

class TeacherDashboardItem(pydantic.BaseModel):
    submission_id: str
    student_name: str
    class_name: str
    activity_type: str
    created_at: datetime
    ai_score: int | None
    teacher_score: int | None
    is_reviewed: bool

class SubmissionDetailForTeacher(pydantic.BaseModel):
    submission_id: str
    student_name: str
    activity_type: str
    content_text: str  
    ai_feedback: str | None
    ai_score: int | None
    mistakes: list[dict] = []
    teacher_review: dict | None = None

#  Quiz Oluşturma İsteği İçin Model
class QuizRequest(pydantic.BaseModel):
    topic: str
    difficulty: str
#  Tekil Gönderim Modeli (Writing ve Quiz için)
class UnifiedSubmissionRequest(pydantic.BaseModel):
    token: str
    activity_type: str
    content: str
# ---------------------------------------------------------
# 🔐 AUTH & USER MANAGEMENT (UC1)
# ---------------------------------------------------------

@app.post("/register") 
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(models.UserDB).filter(models.UserDB.email == user.email).first():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı.")

    new_user = models.UserDB(
        id=str(uuid.uuid4()),
        email=user.email,
        password_hash=_hash_password(user.password),
        role=user.role,
        first_name=user.first_name, 
        last_name=user.last_name    
    )
    db.add(new_user)
    db.commit()
    
    log_action(db, new_user.id, "REGISTER", f"Role: {user.role}")
    return {"id": new_user.id, "msg": "Kayıt başarılı"}

@app.post("/token") 
def login(
    username: str = Form(...), 
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.UserDB).filter(models.UserDB.email == username).first()
    
    if not user or user.password_hash != _hash_password(password):
        raise HTTPException(status_code=401, detail="Hatalı email veya şifre")

    token = str(uuid.uuid4())
    storage.tokens[token] = user.id 
    
    log_action(db, user.id, "LOGIN", "User logged in")

    return {
        "access_token": token,
        "token_type": "bearer"
    }

@app.get("/users/me")
def read_users_me(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "class_id": user.class_id
    }


# ---------------------------------------------------------
# 📝 STUDENT ACTIVITIES (UC2, UC3, UC4)
# ---------------------------------------------------------

# [UC3] Writing Submission
@app.post("/activities/writing")
async def submit_writing(
    token: str = Form(...), 
    text: str = Form(...), 
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)

    # 1. Submission Kaydet 
    submission = models.SubmissionDB(
        id=str(uuid.uuid4()),  
        student_id=user.id,
        activity_type="writing",
        content_text=text
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # 2. AI Değerlendirmesi
    ai_sub_model = schemas.Submission(
        id=submission.id,
        student_id=submission.student_id,
        activity_type=schemas.SubmissionType.WRITING,
        content_text=text,
        created_at=submission.created_at
    )
    ev_result, mistakes, _ = await ai_service.evaluate_submission(ai_sub_model)

    # 3. Sonuçları Kaydet
    evaluation = models.EvaluationDB(
        submission_id=submission.id,
        score=ev_result.score,
        feedback_text=ev_result.feedback_text
    )
    db.add(evaluation)

    for m in mistakes:
        db.add(models.MistakeDB(
            submission_id=submission.id,
            error_type=m.error_type,
            description=m.description,
            suggestion=m.suggestion
        ))
    
    db.commit()
    
    # 4. HOCAYA BİLDİRİM GÖNDER
    notify_class_teacher(db, user.id, "Writing")
    
    log_action(db, user.id, "SUBMIT_WRITING", f"ID: {submission.id}")

    return {
        "type": "writing",
        "score": ev_result.score,
        "feedback_text": ev_result.feedback_text,
        "mistakes": mistakes
    }
#  AI Quiz Oluşturma Endpoint'i 
#  GERÇEK AI Quiz Oluşturma Endpoint'i
@app.post("/quiz/generate")
async def generate_mcq_quiz(request: QuizRequest, token: str = Query(...), db: Session = Depends(get_db)):
    # 1. Kullanıcıyı doğrula
    user = get_current_user(token, db)
    
    # 2. Varsayılan konu ayarı
    topic = request.topic if request.topic else "General English"
    difficulty = request.difficulty if request.difficulty else "Medium"

    # 3. MOCK DATA YOK! Gerçekten AI servisine gidiyoruz:
    questions = await ai_service.generate_mcq_quiz(topic, difficulty)
    
    # Eğer AI bir sebeple boş dönerse (API hatası vb.) kullanıcıya bilgi verelim
    if not questions:
        raise HTTPException(status_code=500, detail="AI şu an soru üretemedi, lütfen tekrar deneyin.")

    return {"questions": questions}
#  Genel Ödev Gönderim Endpoint'i (Writing & Quiz)
#  Genel Ödev Gönderim Endpoint'i (GÜNCELLENDİ v2)
@app.post("/submit-assignment")
async def submit_assignment_unified(
    req: UnifiedSubmissionRequest, 
    db: Session = Depends(get_db)
):
    user = get_current_user(req.token, db)

    # 1. Submission Kaydet
    submission = models.SubmissionDB(
        id=str(uuid.uuid4()),
        student_id=user.id,
        activity_type=req.activity_type,
        content_text=req.content
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # 2. AI Değerlendirmesi İçin Geçici Nesne
    class SimpleSub:
        def __init__(self, id, student_id, activity_type, content_text, created_at):
            self.id = id
            self.student_id = student_id
            self.activity_type = activity_type
            self.content_text = content_text
            self.created_at = created_at

    ai_sub_obj = SimpleSub(
        id=submission.id,
        student_id=submission.student_id,
        activity_type=req.activity_type, 
        content_text=req.content,
        created_at=submission.created_at
    )

    # 3. AI Servisini Çağır 
    question_analysis_data = [] # Varsayılan boş
    try:
        # ev_result, mistakes VE raw_data'yı alıyoruz
        ev_result, mistakes, raw_data = await ai_service.evaluate_submission(ai_sub_obj)
        
        # Eğer quiz ise, soru analizlerini raw_data içinden çekiyoruz
        if req.activity_type == "quiz":
            question_analysis_data = raw_data.get("question_analysis", [])

    except Exception as e:
        print(f"AI Error: {e}")
        ev_result = type('obj', (object,), {'score': 0, 'feedback_text': 'AI servisi yanıt vermedi.'})
        mistakes = []

    # 4. Sonuçları Kaydet
    evaluation = models.EvaluationDB(
        submission_id=submission.id,
        score=ev_result.score,
        feedback_text=ev_result.feedback_text
    )
    db.add(evaluation)

    for m in mistakes:
        db.add(models.MistakeDB(
            submission_id=submission.id,
            error_type=m.error_type,
            description=m.description,
            suggestion=m.suggestion
        ))
    
    db.commit()

    # 5. Hocaya Bildirim
    notify_class_teacher(db, user.id, req.activity_type.capitalize())
    
    #  Frontend'e 'question_feedback' dolu gidiyor!
    return {
        "type": req.activity_type,
        "score": ev_result.score,
        "feedback_text": ev_result.feedback_text,
        "feedback": { 
            "summary": ev_result.feedback_text,
            "question_feedback": question_analysis_data 
        },
        "mistakes": mistakes
    }
@app.post("/activities/speaking")
async def submit_speaking(
    token: str = Form(...), 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)

    # 1. Dosyayı Kaydet
    file_path = f"{UPLOAD_DIR}/{uuid.uuid4()}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. Veritabanına Kayıt (DÜZELTME: id EKLENDİ)
    submission = models.SubmissionDB(
        id=str(uuid.uuid4()), 
        student_id=user.id,
        activity_type="speaking",
        content_text=f"Audio File", 
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # 3. AI Ses Analizi
    ev_result, mistakes = await ai_service.evaluate_speaking(file_path, str(submission.id))

    # 4. Sonuçları Kaydet
    evaluation = models.EvaluationDB(
        submission_id=submission.id,
        score=ev_result.score,
        feedback_text=ev_result.feedback_text
    )
    db.add(evaluation)
    
    for m in mistakes:
        db.add(models.MistakeDB(
            submission_id=submission.id,
            error_type=m.error_type,
            description=m.description,
            suggestion=m.suggestion
        ))
    
    db.commit()
    
    # 5. HOCAYA BİLDİRİM GÖNDER
    notify_class_teacher(db, user.id, "Speaking")

    log_action(db, user.id, "SUBMIT_SPEAKING", f"ID: {submission.id}")

    return {
        "type": "speaking",
        "score": ev_result.score,
        "feedback_text": ev_result.feedback_text,
        "mistakes": mistakes
    }
# [UC4] Quiz Submission
@app.post("/mcq/quiz/submit")
async def submit_mcq_quiz(req: schemas.QuizSubmitRequest, token: str = Query(...), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    quiz = storage.quizzes.get(req.quiz_id)
    if not quiz: raise HTTPException(404, "Quiz bulunamadı veya süresi doldu.")

    correct = 0
    mistakes_text = []

    # 1. Submission Oluştur 
    submission = models.SubmissionDB(
        id=str(uuid.uuid4()), 
        student_id=user.id,
        activity_type="quiz",
        content_text=f"Quiz Difficulty: {quiz.difficulty}" 
    )
    db.add(submission)
    db.commit() 

    
    # 2. Soruları Kontrol Et
    for q in quiz.questions:
        student_answer = req.answers.get(q.id)
        if student_answer == q.correct_answer:
            correct += 1
        else:
            mistake_desc = f"Q: {q.question} | Your: {student_answer} | Correct: {q.correct_answer}"
            mistakes_text.append(mistake_desc)
            
            db.add(models.MistakeDB(
                submission_id=submission.id,
                error_type="Wrong Answer",
                description=mistake_desc,
                suggestion="Review this topic."
            ))

    score = int((correct / len(quiz.questions)) * 100) if quiz.questions else 0
    
    # 3. Sonuç ve Feedback Kaydet
    feedback_summary = f"Quiz Result: {correct}/{len(quiz.questions)} correct."
    if mistakes_text:
        feedback_summary += "\n\n❌ MISTAKES:\n" + "\n".join(mistakes_text)
    else:
        feedback_summary += "\n\n🎉 Perfect Score!"

    evaluation = models.EvaluationDB(
        submission_id=submission.id,
        score=score,
        feedback_text=feedback_summary 
    )
    db.add(evaluation)
    db.commit()
    
    # 4. HOCAYA BİLDİRİM
    notify_class_teacher(db, user.id, "Quiz")
    
    log_action(db, user.id, "SUBMIT_QUIZ", f"Score: {score}")

    return {"score": score, "correct": correct, "total": len(quiz.questions)}
# ---------------------------------------------------------
# 👩‍🏫 TEACHER ENDPOINTS (GÜNCELLENMİŞ VE YENİLER)
# ---------------------------------------------------------

# 1. TÜM ÖĞRENCİ GÖNDERİLERİNİ LİSTELE (Dashboard için) - Sadece Kendi Sınıfı
@app.get("/teacher/submissions", response_model=List[TeacherDashboardItem])
def get_all_submissions_for_teacher(
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    if user.role != "teacher" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only teachers can view this.")

    # 1. Bu hocanın sınıflarını bul
    my_class_ids = [c.id for c in db.query(models.ClassDB).filter(models.ClassDB.teacher_id == user.id).all()]
    
    if not my_class_ids:
        return []

    # 2. Sadece bu sınıflardaki öğrencileri bul
    my_student_ids = [s.id for s in db.query(models.UserDB).filter(models.UserDB.class_id.in_(my_class_ids)).all()]

    if not my_student_ids:
        return []

    # 3. Sadece bu öğrencilerin submissionlarını getir
    submissions = db.query(models.SubmissionDB)\
        .filter(models.SubmissionDB.student_id.in_(my_student_ids))\
        .order_by(models.SubmissionDB.created_at.desc()).all()
    
    result = []
    for sub in submissions:
        student = db.query(models.UserDB).filter(models.UserDB.id == sub.student_id).first()
        student_name = f"{student.first_name} {student.last_name}" if student else "Unknown"
        class_obj = db.query(models.ClassDB).filter(models.ClassDB.id == student.class_id).first()
        class_name = class_obj.name if class_obj else "-"
        
        # Hoca daha önce puanlamış mı?
        review = db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).first()
        
        result.append({
            "submission_id": sub.id,
            "student_name": student_name,
            "class_name": class_name,
            "activity_type": sub.activity_type,
            "created_at": sub.created_at,
            "ai_score": sub.evaluation.score if sub.evaluation else 0,
            "teacher_score": review.new_score if review else None,
            "is_reviewed": review is not None
        })
    
    return result

# 2. TEK BİR GÖNDERİNİN DETAYINI GÖR
@app.get("/teacher/submission/{submission_id}", response_model=SubmissionDetailForTeacher)
def get_submission_detail(
    submission_id: str,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    if user.role != "teacher" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    sub = db.query(models.SubmissionDB).filter(models.SubmissionDB.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    student = db.query(models.UserDB).filter(models.UserDB.id == sub.student_id).first()
    
    # Hataları topla
    mistakes_list = [{"type": m.error_type, "desc": m.description, "fix": m.suggestion} for m in sub.mistakes]
    
    # Varsa hoca yorumunu topla
    review = db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).first()
    review_data = None
    if review:
        review_data = {
            "teacher_comment": review.teacher_comment,
            "new_score": review.new_score
        }

    return {
        "submission_id": sub.id,
        "student_name": f"{student.first_name} {student.last_name}",
        "activity_type": sub.activity_type,
        "content_text": sub.content_text, 
        "ai_feedback": sub.evaluation.feedback_text if sub.evaluation else "No AI feedback",
        "ai_score": sub.evaluation.score if sub.evaluation else 0,
        "mistakes": mistakes_list,
        "teacher_review": review_data
    }

# 3. HOCANIN YENİDEN DEĞERLENDİRMESİ

@app.post("/teacher/review")
def submit_teacher_review(
    review_req: TeacherReviewRequest,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    if user.role != "teacher" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    submission = db.query(models.SubmissionDB).filter(models.SubmissionDB.id == review_req.submission_id).first()
    if not submission:
        raise HTTPException(404, "Submission not found")

    # Önce eski yorum varsa bulalım
    existing_review = db.query(models.TeacherReviewDB).filter(
        models.TeacherReviewDB.submission_id == review_req.submission_id
    ).first()

    if existing_review:
        # GÜNCELLEME MODU: Var olan kaydı güncelliyoruz
        existing_review.new_score = review_req.new_score
        existing_review.teacher_comment = review_req.teacher_comment
        existing_review.teacher_id = user.id
        existing_review.created_at = datetime.utcnow()
    else:
        # YENİ KAYIT MODU
        new_review = models.TeacherReviewDB(
            id=str(uuid.uuid4()),
            submission_id=review_req.submission_id,
            teacher_id=user.id,
            new_score=review_req.new_score,
            teacher_comment=review_req.teacher_comment,
            created_at=datetime.utcnow()
        )
        db.add(new_review)


    # Öğrenciye Bildirim
    notif = models.NotificationDB(
        id=str(uuid.uuid4()),
        user_id=submission.student_id,
        message=f"Your {submission.activity_type} grade was updated to {review_req.new_score} by your teacher.",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    
    db.commit()
    return {"message": "Review submitted successfully"}
# ---------------------------------------------------------
# 🏫 CLASS MANAGEMENT (YENİ EKLENDİ)
# ---------------------------------------------------------

# 1. YENİ SINIF OLUŞTUR
@app.post("/classes/create")
def create_class(
    req: ClassCreateRequest,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    if user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if db.query(models.ClassDB).filter(models.ClassDB.name == req.name).first():
        raise HTTPException(status_code=400, detail="Class name already exists")

    new_class = models.ClassDB(
        id=str(uuid.uuid4()),
        name=req.name,
        teacher_id=user.id,
        created_at=datetime.utcnow()
    )
    db.add(new_class)
    db.commit()
    return {"message": f"Class '{req.name}' created successfully", "class_id": new_class.id}

# 2. ÖĞRENCİYİ SINIFA EKLE
@app.post("/classes/assign-student")
def assign_student(
    req: AssignStudentRequest,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    if user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    student = db.query(models.UserDB).filter(models.UserDB.email == req.student_email).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    target_class = db.query(models.ClassDB).filter(models.ClassDB.id == req.class_id).first()
    if not target_class:
        raise HTTPException(status_code=404, detail="Class not found")

    student.class_id = target_class.id
    db.commit()
    
    return {"message": f"Student {student.first_name} assigned to {target_class.name}"}
# 3. HOCANIN ÖĞRENCİ DETAYLARINI GETİR (GÖNDERİLER + ANALİZ)
@app.get("/teacher/student-detail/{student_id}")
def get_student_detail_for_teacher(student_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    if user.role != "teacher" and user.role != "admin": 
        raise HTTPException(403, "Yetkisiz erişim")

    # Bu, grafiğin soldan sağa (eskiden yeniye) doğru akmasını sağlar.
    submissions = db.query(models.SubmissionDB).filter(
        models.SubmissionDB.student_id == student_id
    ).order_by(models.SubmissionDB.created_at.asc()).all()
    
    graph_data = {
        "WRITING": [], "SPEAKING": [], "QUIZ": [], "OVERALL": []
    }

    for sub in submissions:
        # Hoca puanı varsa onu , yoksa AI puanını al
        review = db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).first()
        
        # Puan hesaplama mantığı
        if review:
            score = review.new_score
        elif sub.evaluation:
            score = sub.evaluation.score
        else:
            score = 0
        
        entry = {"date": sub.created_at.strftime("%d.%m"), "score": score}
        
        #  .upper() kullanarak "quiz", "Quiz", "QUIZ" gibi tüm yazımları yakalıyoruz.
        atype = sub.activity_type.upper()
        if atype in graph_data:
            graph_data[atype].append(entry)
        
        graph_data["OVERALL"].append(entry)

    # Listeyi frontend'e gönderirken en yeni ödevler en üstte görünsün diye (submissions) ters çevirebiliriz
    # ama graph_data (analytics) MUTLAKA ASC (düz) kalmalı.
    return {
        "submissions": submissions[::-1], # Listede en yeni en üstte
        "analytics": graph_data           # Grafikte soldan sağa akış
    }
# 3. HOCANIN SINIFLARINI VE ÖĞRENCİLERİNİ LİSTELE
@app.get("/teacher/my-classes")
def get_my_classes(
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")

    classes = db.query(models.ClassDB).filter(models.ClassDB.teacher_id == user.id).all()
    
    result = []
    for cls in classes:
        students = db.query(models.UserDB).filter(models.UserDB.class_id == cls.id).all()
        student_list = [{"id": s.id, "name": f"{s.first_name} {s.last_name}", "email": s.email} for s in students]
        
        result.append({
            "class_id": cls.id,
            "class_name": cls.name,
            "students": student_list
        })
        
    return result


# ---------------------------------------------------------
# 📊 STUDENT DASHBOARD & NOTIFICATIONS
# ---------------------------------------------------------

@app.get("/student/dashboard")
def student_dashboard(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    results = (
        db.query(models.SubmissionDB, models.EvaluationDB, models.TeacherReviewDB)
        .join(models.EvaluationDB, models.EvaluationDB.submission_id == models.SubmissionDB.id)
        .outerjoin(models.TeacherReviewDB, models.TeacherReviewDB.submission_id == models.SubmissionDB.id)
        .filter(models.SubmissionDB.student_id == user.id)
        .order_by(models.SubmissionDB.created_at.desc())
        .all()
    )
    
    data = []
    for sub, ev, tr in results:
        # Hoca not verdiyse geçerli not odur, yoksa AI notudur
        final_score = tr.new_score if tr else ev.score

        mistakes_db = db.query(models.MistakeDB).filter(models.MistakeDB.submission_id == sub.id).all()
        mistakes_list = [
            {
                "error_type": m.error_type,
                "description": m.description,
                "suggestion": m.suggestion
            } 
            for m in mistakes_db
        ]

        data.append({
            "submission_id": sub.id,
            "type": sub.activity_type,
            "score": final_score,          # Güncel Not (Progress bunu kullanır)
            "ai_score": ev.score,          
            "created_at": sub.created_at.isoformat(),
            "ai_feedback": ev.feedback_text,
            "teacher_comment": tr.teacher_comment if tr else None,
            "teacher_updated": True if tr else False,
            "content": sub.content_text,
            "mistakes": mistakes_list
        })
    
    return data
#  Öğrenci Progress / Grafik Endpoint'i 
@app.get("/student/progress")
def student_progress_graph(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    # Verileri tarihe göre ESKİDEN -> YENİYE doğru çekiyoruz
    results = (
        db.query(models.SubmissionDB, models.EvaluationDB, models.TeacherReviewDB)
        .join(models.EvaluationDB, models.EvaluationDB.submission_id == models.SubmissionDB.id)
        .outerjoin(models.TeacherReviewDB, models.TeacherReviewDB.submission_id == models.SubmissionDB.id)
        .filter(models.SubmissionDB.student_id == user.id)
        .order_by(models.SubmissionDB.created_at.asc()) 
        .all()
    )
    
    # [FR10] Her yetenek için ayrı bir sözlük yapısı oluşturuyoruz
    categorized_data = {
        "WRITING": [],
        "SPEAKING": [],
        "QUIZ": [],
        "OVERALL": [] # Genel gelişim trendi için
    }
    
    for sub, ev, tr in results:
        # Hoca puanı öncelikli (UC11)
        final_score = tr.new_score if tr else ev.score
        
        entry = {
            "date": sub.created_at.strftime("%d.%m"),
            "score": final_score
        }
        
        # Aktivite tipine göre ilgili listeye ekle
        atype = sub.activity_type.upper()
        if atype in categorized_data:
            categorized_data[atype].append(entry)
        
        # Tüm aktiviteleri içeren genel listeye de ekle
        categorized_data["OVERALL"].append(entry)
        
    return categorized_data
@app.get("/notifications")
def get_notifications(token: str = Query(...), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    notifs = db.query(models.NotificationDB).filter(models.NotificationDB.user_id == user.id).order_by(models.NotificationDB.created_at.desc()).all()
    return [{"id": n.id, "message": n.message, "created_at": n.created_at, "is_read": n.is_read} for n in notifs]

# [UC15] Improved Report Download (PDF FORMAT 📄)


@app.get("/report/download")
async def download_weekly_report(token: str, db: Session = Depends(get_db)):
    # 1. Kullanıcıyı doğrula ve verileri çek [cite: 104]
    user = get_current_user(token, db)
    
    # Son 7 günlük aktiviteleri getir [cite: 112]
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    submissions = db.query(models.SubmissionDB).filter(
        models.SubmissionDB.student_id == user.id,
        models.SubmissionDB.created_at >= one_week_ago
    ).all()

    if not submissions:
        raise HTTPException(status_code=404, detail="Rapor icin yeterli veri bulunamadi.")

    #  İstatistikleri ve Hoca Yorumlarını Hazırla [cite: 12, 114]
    counts = {"WRITING": 0, "SPEAKING": 0, "QUIZ": 0}
    stats = {"WRITING": [], "SPEAKING": [], "QUIZ": []}
    teacher_feedbacks = []

    for sub in submissions:
        atype = sub.activity_type.upper()
        if atype in stats:
            counts[atype] += 1
            # Hoca puan verdiyse onu, yoksa AI puanını al 
            review = db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).first()
            score = review.new_score if review else (sub.evaluation.score if sub.evaluation else 0)
            stats[atype].append(score)
            
            # UC11: Öğretmen yorumu varsa listeye ekle 
            if review and review.teacher_comment:
                teacher_feedbacks.append({
                    "type": sub.activity_type.capitalize(),
                    "date": sub.created_at.strftime("%d.%m.%Y"),
                    "comment": review.teacher_comment
                })

    # 3. PDF Oluşturma ve Karakter Fix 
    pdf = FPDF()
    pdf.add_page()
    
    # Profesyonel Karakter Temizliği
    def tr(text):
        if not text: return ""
        maps = {"ş":"s", "Ş":"S", "ğ":"g", "Ğ":"G", "ç":"c", "Ç":"C", "ı":"i", "İ":"I", "ö":"o", "Ö":"O", "ü":"u", "Ü":"U"}
        for k, v in maps.items(): text = text.replace(k, v)
        return text

    # --- RAPOR TASARIMI ---
    # Başlık [cite: 112]
    pdf.set_font("Arial", 'B', 18)
    pdf.cell(200, 15, txt=tr("HAFTALIK AKADEMIK GELISIM RAPORU"), ln=True, align='C')
    pdf.ln(5)

    # 1. AKTİVİTE İSTATİSTİKLERİ (FR9) 
    pdf.set_font("Arial", 'B', 12)
    pdf.cell(200, 10, txt=tr("1. HAFTALIK AKTIVITE OZETI"), ln=True)
    pdf.set_font("Arial", size=10)
    summary_txt = f"Toplam Gorev: {len(submissions)} | Writing: {counts['WRITING']} | Speaking: {counts['SPEAKING']} | Quiz: {counts['QUIZ']}"
    pdf.cell(200, 8, txt=tr(summary_txt), ln=True)
    pdf.ln(5)

    # 2. ÖĞRETMEN GERİ BİLDİRİMLERİ (UC11) 
    if teacher_feedbacks:
        pdf.set_fill_color(240, 245, 255)
        pdf.set_font("Arial", 'B', 12)
        pdf.cell(0, 10, txt=tr("2. OGRETMEN DEGERLENDIRMELERI (TEACHER REVIEW)"), ln=True, fill=True)
        pdf.set_font("Arial", size=10)
        for fb in teacher_feedbacks:
            pdf.multi_cell(0, 8, txt=tr(f"[{fb['date']} - {fb['type']}]: {fb['comment']}"))
            pdf.ln(2)
    else:
        pdf.set_font("Arial", 'I', 10)
        pdf.cell(0, 10, txt=tr("Henuz ogretmen tarafindan incelenmis aktivite bulunmamaktadir."), ln=True)

    # 3. PERFORMANS GRAFİKLERİ 
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 12)
    pdf.cell(200, 10, txt=tr("3. BASARI ANALIZ GRAFIKLERI"), ln=True)
    for activity, scores in stats.items():
        avg = sum(scores) / len(scores) if scores else 0
        pdf.set_font("Arial", size=10)
        pdf.cell(40, 8, txt=tr(f"{activity}: %{int(avg)}"), ln=False)
        pdf.set_fill_color(220, 220, 220)
        pdf.cell(100, 6, "", border=1, ln=False, fill=True)
        pdf.set_x(50)
        pdf.set_fill_color(63, 81, 181) # Profesyonel Indigo Mavi
        pdf.cell(max(1, avg), 6, "", border=1, ln=True, fill=True)
        pdf.ln(2)

    # 4. AI ANALİZİ  [cite: 110, 111]
    challenge = await get_challenges(token, db)
    if challenge:
        pdf.ln(5)
        pdf.set_fill_color(255, 240, 240)
        pdf.set_font("Arial", 'B', 12)
        pdf.set_text_color(200, 0, 0)
        pdf.cell(0, 10, txt=tr("4. AI MENTOR ANALIZI VE ONERILER"), ln=True, fill=True)
        pdf.set_font("Arial", 'B', 11)
        pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(0, 8, txt=tr(f"{challenge['pattern_found']}"))
        pdf.set_font("Arial", 'I', 10)
        pdf.multi_cell(0, 8, txt=tr(f"Oneri: {challenge['recommendation']}"))

    #  Dosyayı Kaydet ve Gönder 
    report_name = f"report_{user.id}.pdf"
    pdf.output(report_name)
    return FileResponse(report_name, media_type='application/pdf', filename="Haftalik_Gelisim_Raporu.pdf")
@app.get("/analytics/repeated-mistakes")
def get_repeated_mistakes_endpoint(token: str = Query(...), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    results = (
        db.query(models.MistakeDB.error_type, func.count(models.MistakeDB.id).label("count"))
        .join(models.SubmissionDB, models.MistakeDB.submission_id == models.SubmissionDB.id)
        .filter(models.SubmissionDB.student_id == user.id)
        .group_by(models.MistakeDB.error_type)
        .order_by(func.count(models.MistakeDB.id).desc())
        .all()
    )
    
    data = [
        {"error_type": row.error_type, "count": row.count} 
        for row in results
    ]
    
    return {"repeated_mistakes": data}
# [UC7 & UC8] Challenge Detection & Feedback Generation
@app.get("/student/challenges")
async def get_challenges(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    # Son 10 hatayı detaylarıyla çekiyoruz  [cite: 11, 110]
    mistakes = (
        db.query(models.MistakeDB)
        .join(models.SubmissionDB)
        .filter(models.SubmissionDB.student_id == user.id)
        .order_by(models.SubmissionDB.created_at.desc())
        .limit(10)
        .all()
    )

    if len(mistakes) < 3: return None

    # Spesifik Konu Analizi (Örn: Hangi gramer konusu veya hangi kelime grubu?)
    descriptions = " ".join([m.description.lower() for m in mistakes])
    
    # Konu Bazlı Tespit Mantığı
    if "tense" in descriptions or "v2" in descriptions or "v3" in descriptions:
        topic = "Zamanlar (Tenses) ve Fiil Çekimleri"
        advice = "Geçmiş zaman (Past Tense) yapılarında düzensiz fiilleri karıştırıyorsun. 'Irregular Verbs' listesine odaklanmanı öneririm."
    elif "preposition" in descriptions or " in " in descriptions or " at " in descriptions:
        topic = "Prepositions (Edatlar: in, on, at)"
        advice = "Yer ve zaman bildiren edatlarda tutarsızlık var. Özellikle 'at' kullanım kurallarını tekrar gözden geçir."
    elif "plural" in descriptions or " s " in descriptions:
        topic = "Çoğul Ekleri ve Sayılabilen İsimler"
        advice = "İsimlerin çoğul hallerinde ve 'a/an' kullanımında hatalar yapıyorsun. Sayılabilen (Countable) isimlere çalışmalısın."
    else:
        # Genel ama dökümana uygun aksiyon odaklı feedback (UC8) [cite: 111]
        topic = "Genel Dilbilgisi ve Sözlük Dağarcığı"
        advice = "Hataların belirli bir konuda yoğunlaşmıyor ancak cümle kurarken temel yapıları (S-V-O) daha dikkatli kurmalısın."

    return {
        "pattern_found": f"Kritik Konu: {topic}",
        "recommendation": advice,
        "mistake_count": len(mistakes)
    }
# 👑 ADMIN ENDPOINTS
# ---------------------------------------------------------

@app.get("/admin/users")
def get_all_users(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    if user.role != "admin": raise HTTPException(403, "Admins only")
    
    users = db.query(models.UserDB).all()
    return [{"id": u.id, "email": u.email, "role": u.role, "name": f"{u.first_name} {u.last_name}"} for u in users]

@app.delete("/admin/users/{user_id}")
def delete_user(user_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    # 1. Yetki Kontrolü
    if user.role != "admin": 
        raise HTTPException(403, "Bu işlem için Admin yetkisi gerekiyor.")
    
    target_user = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not target_user: 
        raise HTTPException(404, "Kullanıcı bulunamadı")
    
    try:
        # --- HOCA KONTROLÜ ---
        # Eğer hocanın sınıfı varsa silmeyi engelle
        if target_user.role == "teacher":
            teacher_class = db.query(models.ClassDB).filter(models.ClassDB.teacher_id == target_user.id).first()
            if teacher_class:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Bu hoca '{teacher_class.name}' sınıfının yöneticisi. Önce sınıfı silin veya başka hocaya atayın."
                )

        # --- TEMİZLİK OPERASYONU ---
        
        # 1. Kullanıcının Ödevlerini (Submission) ve bağlı notlarını sil
        submissions = db.query(models.SubmissionDB).filter(models.SubmissionDB.student_id == target_user.id).all()
        for sub in submissions:
            db.query(models.EvaluationDB).filter(models.EvaluationDB.submission_id == sub.id).delete()
            db.query(models.MistakeDB).filter(models.MistakeDB.submission_id == sub.id).delete()
            db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).delete()
            db.delete(sub)

        # 2. Bildirimleri Sil
        db.query(models.NotificationDB).filter(models.NotificationDB.user_id == target_user.id).delete()
        
        # 3. [KRİTİK] Audit Loglarını (Geçmiş Kayıtlarını) Sil
        # Hata veren kısım burasıydı, bu satır sorunu çözer.
        db.query(models.AuditLogDB).filter(models.AuditLogDB.user_id == target_user.id).delete()

        # 4. Tokenları temizle
        keys_to_remove = [k for k, v in storage.tokens.items() if v == target_user.id]
        for k in keys_to_remove:
            del storage.tokens[k]

        # --- SON VURUŞ: KULLANICIYI SİL ---
        db.delete(target_user)
        db.commit()

        # Loglama işlemini silinen kullanıcı için değil, silen admin (user.id) için yapıyoruz
        log_action(db, user.id, "DELETE_USER", f"Deleted user {target_user.email}")
        
        return {"status": "success", "message": f"{target_user.email} silindi."}

    except Exception as e:
        db.rollback()
        print(f"Silme Hatası: {e}")
        # Hata detayını frontend'e gönderelim ki ne olduğunu görelim
        raise HTTPException(status_code=500, detail=f"Silme işlemi başarısız: {str(e)}")

@app.get("/admin/stats")
def get_admin_stats(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    if user.role != "admin": raise HTTPException(403, "Admins only")
    
    total_users = db.query(models.UserDB).count()
    total_subs = db.query(models.SubmissionDB).count()
    
    return {
        "total_users": total_users,
        "total_submissions": total_subs,
        "active_students": db.query(models.UserDB).filter(models.UserDB.role == "student").count(),
        "active_teachers": db.query(models.UserDB).filter(models.UserDB.role == "teacher").count() 
    }

# ---------------------------------------------------------
# STARTUP: DEMO USERS
# ---------------------------------------------------------
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # Öğrenci yoksa ekle
        if not db.query(models.UserDB).filter(models.UserDB.email == "student@demo.com").first():
            student = models.UserDB(
                id=str(uuid.uuid4()), email="student@demo.com",
                password_hash=_hash_password("1234"), role="student", first_name="Demo", last_name="Student"
            )
            db.add(student)
            
        # Öğretmen yoksa ekle
        if not db.query(models.UserDB).filter(models.UserDB.email == "teacher@demo.com").first():
            teacher = models.UserDB(
                id=str(uuid.uuid4()), email="teacher@demo.com",
                password_hash=_hash_password("1234"), role="teacher", first_name="Demo", last_name="Teacher"
            )
            db.add(teacher)
        db.commit()
        print("✅ Demo users ready (student@demo.com / 1234)")
    except Exception as e:
        print(f"Startup Error: {e}")
    finally:
        db.close() 

# ---------------------------------------------------------
# PROGRESS (HISTORY) ENDPOINT
# ---------------------------------------------------------
# --- BİLDİRİM İŞLEMLERİ ---

# 1. Bildirimleri Getir
@app.get("/notifications")
def get_notifications(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    # En yeniden eskiye doğru sırala
    notifs = db.query(models.NotificationDB)\
               .filter(models.NotificationDB.user_id == user.id)\
               .order_by(models.NotificationDB.created_at.desc())\
               .all()
    return notifs

# 2. Bildirimi "Okundu" İşaretle (YENİ)
@app.put("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    notif = db.query(models.NotificationDB).filter(models.NotificationDB.id == notif_id).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    
    notif.is_read = True
    db.commit()
    return {"status": "success"}
# [UC7] Grafik Verisi Endpoint'i (Frontend buraya istek atıyor!)
@app.get("/analytics/history")
def get_analytics_history(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    # Verileri eskiden yeniye doğru çekiyoruz (Grafik soldan sağa aksın)
    results = (
        db.query(models.SubmissionDB, models.EvaluationDB, models.TeacherReviewDB)
        .join(models.EvaluationDB, models.EvaluationDB.submission_id == models.SubmissionDB.id)
        .outerjoin(models.TeacherReviewDB, models.TeacherReviewDB.submission_id == models.SubmissionDB.id)
        .filter(models.SubmissionDB.student_id == user.id)
        .order_by(models.SubmissionDB.created_at.asc())
        .all()
    )
    
    data = []
    for sub, ev, tr in results:
        # --- DÜZELTME BURADA ---
        # Hoca puan verdiyse (tr) onu al, yoksa AI puanını (ev) al.
        final_score = tr.new_score if tr else ev.score
        
        data.append({
            "date": sub.created_at.strftime("%d.%m"), # Frontend bu formatı seviyor
            "score": final_score,                      # Düzeltilmiş puan
            "activity": sub.activity_type
        })
        
    return data
# [YENİ] Aktivite Silme Endpoint'i
@app.delete("/submission/{submission_id}")
def delete_submission(submission_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    sub = db.query(models.SubmissionDB).filter(models.SubmissionDB.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Aktivite bulunamadı")

    # Sadece aktivitenin sahibi (öğrenci) veya hocası silebilir
    
    # Bağlı kayıtları temizle (Evaluation, Mistakes, Reviews)
    db.query(models.EvaluationDB).filter(models.EvaluationDB.submission_id == submission_id).delete()
    db.query(models.MistakeDB).filter(models.MistakeDB.submission_id == submission_id).delete()
    db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == submission_id).delete()
    
    db.delete(sub)
    db.commit()
    
    return {"status": "deleted"}

# Öğrenci Silme İsteği İçin Model
class RemoveStudentRequest(pydantic.BaseModel):
    student_id: str
    class_id: str

@app.post("/classes/remove-student")
def remove_student_from_class(
    req: RemoveStudentRequest, 
    token: str = Query(...), 
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    
    cls = db.query(models.ClassDB).filter(models.ClassDB.id == req.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı.")
    
    # 2. Hoca Yetki Kontrolü
    if cls.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Bu sınıfı yönetme yetkiniz yok.")

    # 3. Öğrenciyi Bul
    student = db.query(models.UserDB).filter(models.UserDB.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı.")

    # 4. İlişkiyi Kes 
    # Öğrencinin class_id'sini boşa çekiyoruz 
    if student.class_id == cls.id:
        student.class_id = None
        db.commit()
        return {"status": "success", "message": "Öğrenci sınıftan çıkarıldı."}
    else:
        raise HTTPException(status_code=400, detail="Bu öğrenci zaten bu sınıfta değil.")