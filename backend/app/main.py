import os
import random
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
class QuizWrapper:
    def __init__(self, id, questions, difficulty):
        self.id = id
        self.questions = questions
        self.difficulty = difficulty
        
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
async def generate_mcq_quiz(
    request: QuizRequest,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)

    # 1. Konu ve Zorluk
    topic = request.topic if request.topic else "General English"
    difficulty = request.difficulty if request.difficulty else "Medium"

    # 2. Rastgelelik
    unique_seed = str(uuid.uuid4())
    styles = ["daily life", "business", "travel", "academic", "storytelling"]
    selected_style = random.choice(styles)

    # 3. 🔒 GRAMMAR / TENSES NET TESPİTİ
    grammar_keywords = [
        "grammar", "tense", "tenses",
        "present", "past", "future",
        "conditional", "if clause",
        "passive", "reported speech"
    ]

    is_grammar = any(k in topic.lower() for k in grammar_keywords)

    # 4. PROMPT OLUŞTURMA
    if is_grammar:
        # --- 🔥 GRAMMAR MODU ---
        final_prompt = f"""
SYSTEM OVERRIDE: YOU ARE A STRICT GRAMMAR EXAM GENERATOR.

ABSOLUTE RULES:
- Generate ONLY grammar-based fill-in-the-blank questions.
- Each question MUST test verb tense or grammatical structure related to "{topic}".
- DO NOT ask word meanings, synonyms, or reading comprehension.
- If a question does NOT test grammar or tense, it is INVALID.

MANDATORY QUESTION FORMAT:
Sentence with ONE blank testing grammar.

EXAMPLE:
"If she ___ earlier, she would have caught the bus."
A) leaves B) left C) had left D) has left

TASK: Generate EXACTLY 5 multiple choice questions.
STYLE: {selected_style} (ONLY for sentence context)
DIFFICULTY: {difficulty}
[Seed: {unique_seed}]
"""
    else:
        # --- KELİME & GENEL MOD ---
        final_prompt = f"""
MODE: VOCABULARY & USAGE
TOPIC: {topic}
CONTEXT: {selected_style}
TASK: Generate 5 engaging multiple choice questions.
INSTRUCTIONS: Focus on vocabulary meaning, usage, or comprehension.
DIFFICULTY: {difficulty}
[Seed: {unique_seed}]
"""

    # 5. AI Servisine Gönder
    questions = await ai_service.generate_mcq_quiz(final_prompt, difficulty)

    if not questions:
        raise HTTPException(status_code=500, detail="AI soru üretemedi.")

    # 6. 🛡️ FAIL-SAFE (SADECE GRAMMAR İÇİN DEVREYE GİRER)
    # Düzeltme: Bu bloğu sadece is_grammar True ise çalıştırıyoruz!
    if is_grammar:
        banned_phrases = [
            "closest in meaning", "what does", "definition",
            "synonym", "mean?", "which word means"
        ]

        filtered_questions = []

        for q in questions:
            text = q.question.lower()

            # 1. Yasaklı kelime var mı?
            if any(bp in text for bp in banned_phrases):
                continue
            
            # 2. Boşluk (___) var mı?
            if "___" not in q.question:
                continue

            filtered_questions.append(q)

        # Eğer sağlam soru sayısı 5'ten azsa hata ver
        if len(filtered_questions) < 5:
            # (Opsiyonel: Hata vermek yerine olduğu kadarını döndürebilirsin ama katı olmak iyidir)
             raise HTTPException(
                status_code=500,
                detail="Grammar mode failed: AI produced non-grammar questions."
            )
        
        # Filtrelenmiş temiz soruları ana değişkene ata
        questions = filtered_questions

    quiz_id = str(uuid.uuid4())
    storage.quizzes[quiz_id] = QuizWrapper(quiz_id, questions, difficulty) # <-- BUNU EKLEMEZSEN AI PUANLAYAMAZ
    
    return {"quiz_id": quiz_id, "questions": questions}



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
async def submit_mcq_quiz(
    req: schemas.QuizSubmitRequest, 
    token: str = Query(...), 
    db: Session = Depends(get_db)
):
    user = get_current_user(token, db)
    
    # 1. Quiz'i Hafızadan Bul
    quiz = storage.quizzes.get(req.quiz_id)
    if not quiz: 
        raise HTTPException(404, "Quiz bulunamadı veya süresi doldu.")

    correct = 0
    mistakes_list_for_ai = [] 
    mistakes_db_objects = [] 

    # 2. Soruları Kontrol Et (PYTHON İLE KESİN HESAP)
    for q in quiz.questions:
        student_answer = str(req.answers.get(q.id, "")).strip()
        correct_answer = str(q.correct_answer).strip()
        
        # Karşılaştırma (Büyük/Küçük harf duyarsız)
        if student_answer.lower() == correct_answer.lower():
            correct += 1
        else:
            # Yanlış cevapları listele
            mistakes_list_for_ai.append({
                "question": q.question,
                "your_answer": student_answer if student_answer else "Boş",
                "correct_answer": correct_answer
            })
            
            mistakes_db_objects.append(models.MistakeDB(
                # id field is Auto-Increment Integer in DB, so we don't pass UUID
                submission_id=None, 
                error_type="Wrong Answer",
                description=f"Soru: {q.question} | Cevabın: {student_answer}",
                suggestion="Review this topic." 
            ))

    # Skoru Hesapla (Kesin Matematik)
    total_questions = len(quiz.questions)
    score = int((correct / total_questions) * 100) if total_questions > 0 else 0
    
    # KONSOL ÇIKTISI (Kontrol etmen için)
    print(f"DEBUG: Python Hesabı -> Doğru: {correct}/{total_questions} | Puan: {score}")

    # 3. AI Servisinden Yorum İste
    ai_comment_text = ""
    detailed_feedback = []

    try:
        # AI'ya hataları gönderiyoruz, o da yorumluyor
        ai_response = await ai_service.generate_mcq_feedback_tr_structured(score, mistakes_list_for_ai)
        
        # AI'nın 'summary'sini alıyoruz ama SKOR olarak değil, YORUM olarak kullanacağız
        ai_comment_text = ai_response.get("summary", "Analiz tamamlandı.")
        detailed_feedback = ai_response.get("question_feedback", [])
        
    except Exception as e:
        print(f"AI Error: {e}")
        ai_comment_text = "AI bağlantısında sorun oluştu, ancak skorunuz kaydedildi."
        detailed_feedback = []

    # --- [DÜZELTME BURASI] ---
    # Skor bilgisini BİZ yazıyoruz (Python), AI'ya bırakmıyoruz.
    # AI'nın yorumunu sadece sonuna ekliyoruz.
    final_feedback_text = f"Sonuç: {total_questions} soruda {correct} doğru yaptınız. (Puan: {score})\n\nAI Yorumu: {ai_comment_text}"

    # 4. Submission Oluştur 
    submission = models.SubmissionDB(
        id=str(uuid.uuid4()), 
        student_id=user.id,
        activity_type="quiz",
        content_text=f"Quiz Difficulty: {quiz.difficulty}" 
    )
    db.add(submission)
    db.commit() 

    # 5. Kayıt (Evaluation)
    evaluation = models.EvaluationDB(
        submission_id=submission.id,
        score=score,                    # <-- KESİN PYTHON SKORU
        feedback_text=final_feedback_text # <-- BİZİM OLUŞTURDUĞUMUZ METİN
    )
    db.add(evaluation)

    # 6. Hataları Kaydet
    for m_db in mistakes_db_objects:
        m_db.submission_id = submission.id
        # AI önerilerini işle
        for df in detailed_feedback:
            if df.get("question") in m_db.description:
                m_db.suggestion = f"Doğru: {df.get('correct_answer')} -> {df.get('explanation')}"
        db.add(m_db)

    db.commit()
    
    # 7. Bildirimler
    notify_class_teacher(db, user.id, "Quiz")
    log_action(db, user.id, "SUBMIT_QUIZ", f"Score: {score}")

    # KESİN ÇÖZÜM: 'mistakes' listesini AI açıklamalarıyla zenginleştiriyoruz
    enriched_mistakes = []
    
    for m in mistakes_list_for_ai:
        # Bu soru için AI'nın ürettiği detayı bul
        # detailed_feedback bir liste, içinde {question, explanation...} var
        explanation = f"Doğru: {m['correct_answer']}" # Varsayılan (AI bulamazsa)
        
        for df in detailed_feedback:
            # Soru metni eşleşiyorsa (veya içeriyorsa)
            if df.get("question") and (df.get("question") in m['question'] or m['question'] in df.get("question")):
                # AI açıklamasını al
                explanation = f"Doğru: {df.get('correct_answer')} -> {df.get('explanation')}"
                break
        
        enriched_mistakes.append({
            "error_type": "Wrong Answer",
            "description": m['question'],
            "suggestion": explanation
        })

    # [YENİ] Frontend Soru Analizi kısmı için TÜM soruları hazırlıyoruz (Sadece hataları değil)
    full_quiz_analysis = []
    for q in quiz.questions:
        u_ans = str(req.answers.get(q.id, "")).strip()
        full_quiz_analysis.append({
            "question": q.question,
            "your_answer": u_ans if u_ans else "Boş",
            "correct_answer": q.correct_answer,
            "explanation": "" # Bu listede açıklama göstermiyoruz artık
        })

    return {
        "type": "quiz",
        "score": score, 
        "correct": correct, 
        "total": total_questions,
        "feedback_text": final_feedback_text,
        "mistakes": enriched_mistakes,
        "feedback": { 
            "summary": final_feedback_text,
            "question_feedback": full_quiz_analysis # <-- ARTIK HEPSİNİ GÖNDERİYORUZ
        }
    }
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

# --- GELİŞMİŞ TÜRKÇE KARAKTER DÜZELTİCİ ---


@app.get("/report/download")
async def download_weekly_report(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    
    # 1. VERİLERİ ÇEK
    one_week_ago = datetime.utcnow() - timedelta(days=7)
    submissions = db.query(models.SubmissionDB).filter(
        models.SubmissionDB.student_id == user.id,
        models.SubmissionDB.created_at >= one_week_ago
    ).all()

    # 2. İSTATİSTİKLERİ HAZIRLA
    stats = {"WRITING": [], "SPEAKING": [], "QUIZ": []}
    
    for sub in submissions:
        atype = sub.activity_type.upper()
        if atype in stats:
            final_score = 0
            review = db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).first()
            if review and review.new_score is not None:
                final_score = review.new_score
            else:
                if hasattr(sub, "ai_score") and sub.ai_score is not None: final_score = sub.ai_score
                elif hasattr(sub, "score") and sub.score is not None: final_score = sub.score
                elif hasattr(sub, "evaluation") and sub.evaluation and hasattr(sub.evaluation, "score"): final_score = sub.evaluation.score
            stats[atype].append(final_score)

    # 3. AI ANALİZİ
    ai_data = await get_challenges(token, db)
    pattern_text = ai_data.get("pattern_found", "Yeterli veri yok.") if ai_data else "Yeterli veri yok."
    recommendation_text = ai_data.get("recommendation", "Bol bol pratik yapmaya devam et!") if ai_data else "Pratik yapmaya devam!"

    # --- 4. PDF OLUŞTURMA (TAM YOL İLE FONT YÜKLEME) ---
    pdf = FPDF()
    pdf.add_page()
    
    report_font = 'Arial' 
    use_unicode = False   

    try:
        # [ÖNEMLİ] Dosyanın Tam Yolunu Buluyoruz
        # main.py dosyasının olduğu klasörü al ve yanındaki fontu bul
        current_dir = os.path.dirname(os.path.abspath(__file__))
        font_path = os.path.join(current_dir, 'DejaVuSans.ttf')
        
        # Fontu Tam Yol ile Yükle
        pdf.add_font('DejaVu', '', font_path, uni=True)
        report_font = 'DejaVu'
        use_unicode = True
        print(f"✅ FONT BAŞARIYLA YÜKLENDİ: {font_path}") # Terminalde bunu görürsen tamamdır
    except Exception as e:
        print(f"❌ FONT YÜKLENEMEDİ: {e}")
        print(f"Aranan Yol: {font_path}")
        report_font = 'Arial'
        use_unicode = False

    # Metin Yazdırma Yardımcısı
    def txt(text):
        if not text: return ""
        if use_unicode: return text 
        
        # Arial Fallback
        replacements = {
            "ş": "s", "Ş": "S", "ğ": "g", "Ğ": "G", "ç":"c", "Ç":"C",
            "ı": "i", "İ": "I", "ö": "o", "Ö": "O", "ü": "u", "Ü": "U"
        }
        for old, new in replacements.items(): text = text.replace(old, new)
        return text

    # BAŞLIK
    pdf.set_font(report_font, '', 16) 
    pdf.set_text_color(26, 35, 126)
    pdf.cell(0, 10, txt=txt("AAFS - AKADEMİK GELİŞİM RAPORU"), ln=True, align='C')
    
    # ALT BAŞLIK
    pdf.set_font(report_font, '', 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, txt=txt(f"Öğrenci: {user.first_name} {user.last_name} | Tarih: {datetime.now().strftime('%d.%m.%Y')}"), ln=True, align='C')
    
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, 30, 200, 30)
    pdf.ln(10)

    # BÖLÜM 1: GRAFİKLER
    pdf.set_font(report_font, '', 12)
    pdf.set_text_color(0, 0, 0)
    pdf.set_fill_color(240, 240, 245)
    pdf.cell(0, 10, txt=txt("1. HAFTALIK PERFORMANS ÖZETİ"), ln=True, fill=True)
    pdf.ln(5)

    categories = ["WRITING", "SPEAKING", "QUIZ"]
    start_x = 40
    base_y = pdf.get_y() + 40
    
    pdf.set_font(report_font, '', 10)
    for i, cat in enumerate(categories):
        scores = stats.get(cat, [])
        avg = sum(scores) / len(scores) if scores else 0
        if avg >= 70: pdf.set_fill_color(76, 175, 80)
        elif avg >= 50: pdf.set_fill_color(255, 152, 0)
        else: pdf.set_fill_color(244, 67, 54)

        bar_height = (avg / 100) * 30
        x_pos = start_x + (i * 45)
        y_pos = base_y - bar_height
        
        if avg > 0:
            pdf.rect(x_pos, y_pos, 30, bar_height, 'F')
            pdf.set_xy(x_pos, y_pos - 5)
            pdf.set_text_color(0,0,0)
            pdf.cell(30, 5, txt=f"%{int(avg)}", align='C')
        else:
            pdf.set_xy(x_pos, base_y - 5)
            pdf.set_text_color(150,150,150)
            pdf.cell(30, 5, txt="-", align='C')

        pdf.set_xy(x_pos, base_y + 2)
        pdf.set_text_color(0,0,0)
        pdf.cell(30, 5, txt=txt(cat), align='C')

    pdf.set_y(base_y + 15)

    # BÖLÜM 2: AI ANALİZİ
    pdf.ln(5)
    pdf.set_font(report_font, '', 12)
    pdf.set_fill_color(255, 235, 238)
    pdf.cell(0, 10, txt=txt("2. YAPAY ZEKA (AI) ANALİZİ"), ln=True, fill=True)
    pdf.ln(2)
    
    pdf.set_font(report_font, '', 11)
    pdf.set_text_color(183, 28, 28)
    pdf.multi_cell(0, 8, txt=txt(pattern_text))
    
    pdf.set_font(report_font, '', 10)
    pdf.set_text_color(0, 0, 0)
    pdf.multi_cell(0, 6, txt=txt(f"Öneri: {recommendation_text}"))

    # BÖLÜM 3: HOCA YORUMLARI
    pdf.ln(5)
    pdf.set_font(report_font, '', 12)
    pdf.set_fill_color(227, 242, 253)
    pdf.cell(0, 10, txt=txt("3. EĞİTMEN GERİBİLDİRİMLERİ"), ln=True, fill=True)
    pdf.ln(2)
    
    has_comments = False
    for sub in submissions:
        review = db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).first()
        if review and review.teacher_comment:
            has_comments = True
            date_str = sub.created_at.strftime('%d.%m.%Y')
            
            pdf.set_fill_color(250, 250, 250)
            pdf.set_draw_color(220, 220, 220)
            
            pdf.set_font(report_font, '', 10)
            pdf.set_text_color(26, 35, 126)
            pdf.cell(0, 8, txt=txt(f"[{date_str} - {sub.activity_type.upper()}]"), ln=True, fill=True, border='TLR')
            
            pdf.set_font(report_font, '', 10)
            pdf.set_text_color(50, 50, 50)
            pdf.multi_cell(0, 6, txt=txt(review.teacher_comment), fill=True, border='BLR')
            pdf.ln(2)

    if not has_comments:
        pdf.set_font(report_font, '', 10)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 10, txt=txt("Bu hafta için henüz bir eğitmen yorumu bulunmamaktadır."), ln=True)

    report_filename = f"Rapor_{user.id}_{datetime.now().strftime('%Y%m%d')}.pdf"
    pdf.output(report_filename)
    return FileResponse(report_filename, media_type='application/pdf', filename=report_filename)
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
#  Challenge Detection & Feedback Generation
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
        # Genel ama dökümana uygun aksiyon odaklı feedback 
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
    
    # Kendi kendini silmeyi engelle
    if target_user.id == user.id:
        raise HTTPException(400, "Kendinizi silemezsiniz.")

    try:
        # --- HOCA İŞLEMLERİ ---
        if target_user.role == "teacher":
            teacher_classes = db.query(models.ClassDB).filter(models.ClassDB.teacher_id == target_user.id).all()
            for t_class in teacher_classes:
                # Sınıftaki öğrencileri serbest bırak
                students_in_class = db.query(models.UserDB).filter(models.UserDB.class_id == t_class.id).all()
                for s in students_in_class:
                    s.class_id = None
                    db.add(s) # Değişikliği işaretle
                
                # Sınıfı sil
                db.delete(t_class)
            
            # Hoca yorumlarını sil
            db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.teacher_id == target_user.id).delete()
            db.flush() # Hoca verilerini veritabanına işle

        # --- ÖĞRENCİ VE GENEL TEMİZLİK ---
        
        # [KRİTİK HAMLE 1] Öğrenciyi Sınıftan Kopart (Öğrenciyse)
        # Eğer bir sınıfa bağlıysa, önce o bağ koparılmalı ki User tablosundan rahat silinsin.
        if target_user.class_id is not None:
            target_user.class_id = None
            db.add(target_user)
            db.flush() # İlişkiyi hemen kes

        # 1. Submission (Ödev) ve Alt Verileri Sil
        submissions = db.query(models.SubmissionDB).filter(models.SubmissionDB.student_id == target_user.id).all()
        for sub in submissions:
            # Önce alt tabloları temizle (Cascade yoksa şarttır)
            db.query(models.EvaluationDB).filter(models.EvaluationDB.submission_id == sub.id).delete()
            db.query(models.MistakeDB).filter(models.MistakeDB.submission_id == sub.id).delete()
            db.query(models.TeacherReviewDB).filter(models.TeacherReviewDB.submission_id == sub.id).delete()
            
            # Sonra ödevi sil
            db.delete(sub)
        
        # [KRİTİK HAMLE 2] Ara Temizlik
        # Submissionlar silindikten sonra veritabanını "Flush" yaparak rahatlatıyoruz.
        db.flush() 

        # 2. Bildirimleri Sil
        db.query(models.NotificationDB).filter(models.NotificationDB.user_id == target_user.id).delete()
        
        # 3. Logları Sil
        db.query(models.AuditLogDB).filter(models.AuditLogDB.user_id == target_user.id).delete()

        # 4. Tokenları temizle (Memory'den silme)
        keys_to_remove = [k for k, v in storage.tokens.items() if v == target_user.id]
        for k in keys_to_remove:
            del storage.tokens[k]

        # --- SON VURUŞ (FİNAL SİLME) ---
        db.delete(target_user)
        
        # [KRİTİK HAMLE 3] Kalıcı Hale Getir
        db.commit()

        log_action(db, user.id, "DELETE_USER", f"Deleted user {target_user.email}")
        
        return {"status": "success", "message": f"{target_user.email} ve verileri kalıcı olarak silindi."}

    except Exception as e:
        db.rollback() # Hata olursa her şeyi geri al
        print(f"Silme Hatası Detaylı: {e}")
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
    # db = SessionLocal()
    # try:
    #     # Öğrenci yoksa ekle - ARTIK EKLEME!
    #     if not db.query(models.UserDB).filter(models.UserDB.email == "student@demo.com").first():
    #         student = models.UserDB(
    #             id=str(uuid.uuid4()), email="student@demo.com",
    #             password_hash=_hash_password("1234"), role="student", first_name="Demo", last_name="Student"
    #         )
    #         db.add(student)
            
    #     # Öğretmen yoksa ekle - ARTIK EKLEME!
    #     if not db.query(models.UserDB).filter(models.UserDB.email == "teacher@demo.com").first():
    #         teacher = models.UserDB(
    #             id=str(uuid.uuid4()), email="teacher@demo.com",
    #             password_hash=_hash_password("1234"), role="teacher", first_name="Demo", last_name="Teacher"
    #         )
    #         db.add(teacher)
    #     db.commit()
    #     print("✅ Demo users check skipped.")
    # except Exception as e:
    #     print(f"Startup Error: {e}")
    # finally:
    #     db.close() 
    pass # Fonksiyon boş kalmasın diye pass koyabilirsin
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