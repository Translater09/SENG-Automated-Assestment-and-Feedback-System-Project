import json
import uuid
import re
from datetime import datetime
from typing import List, Tuple

import google.generativeai as genai

from .config import GOOGLE_API_KEY
from .models import (
    Submission,
    EvaluationResult,
    Mistake,
    QuizQuestion
)


class AIService:
    def __init__(self):
        if not GOOGLE_API_KEY:
            print("⚠️ UYARI: Google API Key bulunamadı!")
        else:
            genai.configure(api_key=GOOGLE_API_KEY)

    # ---------------------------------------------------------
    # 🧠 AKILLI MODEL SEÇİMİ VE İÇERİK ÜRETİMİ 
    # ---------------------------------------------------------
    def _generate_content_safe(self, prompt: str):
        """
        Senin paneline (Screenshot) göre en uygun modelleri sırayla dener.
        Kırmızı yanan modelleri atlayıp yeşil olanlara geçer.
        """
        # LİSTE: Senin hesabındaki duruma göre sıralandı
        candidate_models = [
            "gemini-2.5-flash-lite", # ✅ 1. Tercih (En Hızlı ve Güvenli - Yeşil Tikli)
            "gemini-2.5-flash",      # 🔴 2. Tercih (Şu an kırmızı ama düzelirse güçlüdür)
            "gemini-1.5-flash",      # 🛡️ 3. Tercih (Standart Hızlı Yedek)
            "gemini-1.5-pro",        # 🧠 4. Tercih (Daha Zeki Yedek)
            "gemini-pro"             # ⚓ 5. Tercih (En eski )
        ]

        last_error = None

        for model_name in candidate_models:
            try:
                # Modeli seç ve üretmeyi dene
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                
                # Konsola hangi modelin çalıştığını yazalım (Debug için iyi olur)
                print(f"✅ Başarılı Model: {model_name}")
                return response
            
            except Exception as e:
                # Hata aldık (Kota veya Servis Hatası), logla ve sıradakine geç
                print(f"⚠️ {model_name} kullanılamadı. Hata: {e}")
                print(f"🔄 Sıradaki modele geçiliyor...")
                last_error = e
                continue # Döngü devam etsin, sıradakini denesin

        # Eğer hepsi hata verdiyse
        raise RuntimeError(f"Tüm modeller denendi ama başarısız oldu. Son hata: {last_error}")

    # ---------------------------------------------------------
    # JSON TEMİZLE
    # ---------------------------------------------------------
    def _clean_json(self, text: str):
        try:
            text = text.replace("```json", "").replace("```", "").strip()
            if text.startswith("["):
                match = re.search(r"\[[\s\S]*\]", text)
            else:
                match = re.search(r"\{[\s\S]*\}", text)

            if match:
                return json.loads(match.group(0))
            return json.loads(text)
        except Exception as e:
            print(f"JSON Parse Hatası: {e}")
            return None

    # ---------------------------------------------------------
    # HATA DURUMU RESULT
    # ---------------------------------------------------------
    def _create_error_result(self, submission: Submission, msg: str):
        ev = EvaluationResult(
            id=str(uuid.uuid4()),
            submission_id=submission.id,
            score=0,
            feedback_text=msg,
            weaknesses="AI_ERROR",
            created_at=datetime.now()
        )
        return ev, []

    
    # WRITING & SPEAKING & QUIZ DEĞERLENDİRME (FİNAL DÜZELTME)
    # ---------------------------------------------------------
    async def evaluate_submission(
        self, submission: Submission
    ) -> Tuple[EvaluationResult, List[Mistake], dict]:

        if not GOOGLE_API_KEY:
            ev, mist = self._create_error_result(submission, "API Key eksik.")
            return ev, mist, {}

        try:
            # 🟢 1. Eğer QUIZ ise
            if submission.activity_type == "quiz":
                prompt = f"""
ROLE: English Teacher grading a Quiz.
TASK: Compare Student Answers vs Correct Answers.
INPUT:
"{submission.content_text}"

CRITICAL INSTRUCTIONS:
1. LANGUAGE: TURKISH (Explain in Turkish).
2. ANALYSIS: Compare the "Student Answer" with "Correct Answer" logically.
   - Note: If student says "Paper" and correct is "Paper", that is CORRECT.
3. OUTPUT: Provide a detailed analysis for EACH question.
- Each question is worth equal points. (Total Score: 100)
- correct_answer must match one of the options exactly
-If the student's answer is not exactly the same as the correct answer (or a very obvious synonym), consider it WRONG.
-NEVER give partial points for incorrect answers. (0 points)
-You must also write the student's grade; each correct answer is worth 20 points.
-Total Score Formula: (Number of Correct Answers / Total Number of Questions) * 100.
OUTPUT FORMAT (JSON ONLY):
{{
  "score": 80,
  "feedback_text": "Genel Türkçe değerlendirme.",
  "question_analysis": [
    {{
      "question": "Original Question Text",
      "your_answer": "Student's Answer (Keep exactly as provided)",
      "correct_answer": "The Correct Answer",
      "explanation": "Brief Turkish explanation of the rule."
    }}
  ]
}}
"""
            # 🔵 2. Eğer WRITING / SPEAKING ise
            else:
                prompt = f"""
ROLE: English Teacher grading a Turkish student.
ACTIVITY TYPE: {submission.activity_type}
STUDENT SUBMISSION:
"{submission.content_text}"

TASK: Analyze grammar, vocabulary, spelling. Explain in TURKISH.

STRICT LANGUAGE & ENTITY RULES:
1. ENTITY PROTECTION: Do NOT flag proper nouns like 'Berkay', 'Ankara', 'Istanbul' as errors. 
   If a word starts with a Capital letter and is a person/city name, it is CORRECT. 

2. LOCALIZATION ASSISTANT: If the user uses a Turkish city or place name that has an English equivalent 
   (e.g., 'Kahire' instead of 'Cairo', 'Viyana' instead of 'Vienna'), flag it as 'Vocabulary Error'.
   Suggestion format: 'In English, you should use [English version]'. 

3. EFFORT GRADING (FR1): Do NOT reject broken English (e.g., 'I cannnt gooo'). 
   Identify the intent, grade based on effort, and list mistakes as Spelling/Grammar. [cite: 33, 137]

4. FULL REJECTION: If the entire text is non-English and contains NO English structure (e.g., 'Naber knk'), 
   set score to 0 and trigger 'Language Error'.

OTHERWISE:
- Analyze grammar, vocabulary, and logic.
- Explain everything in TURKISH.

OUTPUT FORMAT (JSON ONLY):
{{
  "score": 0-100,
  "feedback_text": "Motivating summary in Turkish",
  "mistakes": [
    {{
      "error_type": "Grammar/Vocabulary/Language Error",
      "description": "Explanation in Turkish",
      "suggestion": "Correction"
    }}
  ]
}}
"""
            
            # AI İsteği
            response = self._generate_content_safe(prompt)
            data = self._clean_json(response.text)

            if not data:
                ev, mist = self._create_error_result(submission, "AI yanıtı okunamadı.")
                return ev, mist, {}

            mistakes_list: List[Mistake] = []

            #  MANTIK DÜZELTME: QUIZ İÇİN HATALARI BİZ OLUŞTURUYORUZ
            if submission.activity_type == "quiz":
                # AI 'mistakes' dizisini doldurmasa bile biz analizden çıkaracağız
                for q in data.get("question_analysis", []):
                    ans_student = str(q.get("your_answer", "")).strip().lower()
                    ans_correct = str(q.get("correct_answer", "")).strip().lower()
                    
                    # Eğer cevap yanlışsa, bunu bir 'Mistake' olarak kaydet
                    if ans_student != ans_correct:
                        mistakes_list.append(
                            Mistake(
                                id=str(uuid.uuid4()),
                                submission_id=submission.id,
                                error_type="Wrong Answer",
                                description=f"Soru: {q.get('question')} | Yanlış Cevap: {q.get('your_answer')}",
                                suggestion=f"Doğru Cevap: {q.get('correct_answer')} -> {q.get('explanation')}"
                            )
                        )
            else:
                # Writing/Speaking için AI'ın verdiği listeyi kullan
                for m in data.get("mistakes", []):
                    raw_error_type = str(m.get("error_type", "General"))
                    if "dil" in raw_error_type.lower() or "kullanım" in raw_error_type.lower():
                        final_error_type = "Language Usage" # Veya "Language Error" hangisini istersen
                    else:
                        final_error_type = raw_error_type
                    mistakes_list.append(
                        Mistake(
                            id=str(uuid.uuid4()),
                            submission_id=submission.id,
                            error_type=final_error_type,
                        
                            description=str(m.get("description", "")),
                            suggestion=str(m.get("suggestion", ""))
                        )
                    )

            # Sonuç Nesnesi
            ev = EvaluationResult(
                id=str(uuid.uuid4()),
                submission_id=submission.id,
                score=int(data.get("score", 0)),
                feedback_text=str(data.get("feedback_text", "Değerlendirme tamamlandı.")),
                weaknesses="",
                created_at=datetime.now()
            )

            return ev, mistakes_list, data

        except Exception as e:
            print(f"Evaluation Error: {e}")
            ev, mist = self._create_error_result(submission, "AI servisi hatası.")
            return ev, mist, {}
  # ---------------------------------------------------------
    # QUIZ OLUŞTUR (GÜNCELLENMİŞ - TOPIC VE DIFFICULTY ALAN)
    # ---------------------------------------------------------
    async def generate_mcq_quiz(self, topic: str, difficulty: str) -> List[QuizQuestion]:
        if not GOOGLE_API_KEY:
            return []

        # Prompt artık hem 'topic' hem de 'difficulty' kullanıyor
        prompt = f"""
ACT AS: Professional English Exam Writer.
TASK: Create 5 Multiple Choice Questions.
TOPIC: {topic}
DIFFICULTY: {difficulty}

RULES:
- JSON ARRAY ONLY
- 4 options per question
- Each question is worth equal points. (Total Score: 100)
- correct_answer must match one of the options exactly
-If the student's answer is not exactly the same as the correct answer (or a very obvious synonym), consider it WRONG.
-NEVER give partial points for incorrect answers. (0 points)
-You must also write the student's grade; each correct answer is worth 20 points.
-Total Score Formula: (Number of Correct Answers / Total Number of Questions) * 100.
- Questions and options must be in English

FORMAT EXAMPLE:
[
  {{
    "question": "What is the past tense of 'go'?",
    "options": ["Goed", "Gone", "Went", "Going"],
    "correct_answer": "Went"
  }}
]
"""

        # Retry logic (JSON hatası olursa 3 kere dener)
        for _ in range(3):
            try:
                # 1. AI'dan içerik üret
                response = self._generate_content_safe(prompt)
                
                # 2. JSON temizle ve parse et
                data = self._clean_json(response.text)

                if isinstance(data, list):
                    questions = []
                    for q in data:
                        questions.append(
                            QuizQuestion(
                                id=str(uuid.uuid4()),
                                question=q["question"],
                                options=q["options"],
                                correct_answer=q["correct_answer"]
                            )
                        )
                    return questions
            except Exception as e:
                print(f"Quiz üretim hatası (Deneme {_}): {e}")

        # Başarısız olursa boş liste dön
        return []
# ---------------------------------------------------------
    # 🎤 SPEAKING EVALUATION 
    # ---------------------------------------------------------
    async def evaluate_speaking(self, file_path: str, submission_id: str):
        """
        Ses dosyasını Gemini'ye yükler, transkriptini çıkarır ve hataları analiz eder.
        FFmpeg gerektirmez, Gemini 1.5 Flash'ın native audio özelliğini kullanır.
        """
        if not GOOGLE_API_KEY:
             # Hata durumunda geçici nesne döndür
            dummy_ev = EvaluationResult(
                id=str(uuid.uuid4()), submission_id=submission_id, score=0, 
                feedback_text="API Key Eksik", weaknesses="System Error", created_at=datetime.now()
            )
            return dummy_ev, []

        try:
            print(f"🎤 Ses dosyası işleniyor: {file_path}")
            
            # 1. Dosyayı Google'a Yükle (Gemini File API)
            # Bu işlem dosyayı geçici olarak Google sunucularına atar
            uploaded_file = genai.upload_file(path=file_path, mime_type="audio/mp3")
            
            # Dosyanın işlenmesini bekle (Genelde 1-2 saniye)
            import time
            while uploaded_file.state.name == "PROCESSING":
                time.sleep(1)
                uploaded_file = genai.get_file(uploaded_file.name)

            if uploaded_file.state.name == "FAILED":
                raise ValueError("Google ses dosyasını işleyemedi.")

            # 2. Prompt Hazırla
            prompt = """
            ROLE: English Teacher.
            TASK: Listen to the audio submission by a Turkish student.
            
            STEPS:
            1. TRANSCRIBE: Write down exactly what the student said (English).
            2. EVALUATE: Analyze grammar, vocabulary, and pronunciation clarity.
            3. OUTPUT: JSON Format Only.

            OUTPUT FORMAT:
            {
              "transcription": "The text student said...",
              "score": 0-100,
              "feedback_text": "General feedback in Turkish",
              "mistakes": [
                {
                  "error_type": "Pronunciation/Grammar",
                  "description": "Explanation in Turkish",
                  "suggestion": "Correction"
                }
              ]
            }
            """

            # 3. Modelden Cevap İste (Gemini 1.5 Flash Ses konusunda çok iyidir)
            # YENİ HALİ (Listende var olan model):
            model = genai.GenerativeModel("gemini-flash-latest")
            response = model.generate_content([prompt, uploaded_file])
            
            # 4. JSON Temizle
            data = self._clean_json(response.text)

            # 5. Sonuçları Nesnelere Dönüştür
            score = int(data.get("score", 0))
            feedback = data.get("feedback_text", "")
            transcription = data.get("transcription", "")
            
            # Feedback'e transkripti de ekleyelim ki öğrenci ne dediğini görsün
            full_feedback = (
                f"**TRANSKRİPT:**\n\"{transcription}\"\n\n"  # Başına ** koyduk ki frontend kalın yapsın
                f"----------------------------------------\n\n"
                f"**YORUM:**\n{feedback}"
            )


            mistakes_list = []
            for m in data.get("mistakes", []):
                mistakes_list.append(
                    Mistake(
                        id=str(uuid.uuid4()),
                        submission_id=submission_id,
                        error_type=str(m.get("error_type", "Speaking Error")),
                        description=str(m.get("description", "")),
                        suggestion=str(m.get("suggestion", ""))
                    )
                )

            ev_result = EvaluationResult(
                id=str(uuid.uuid4()),
                submission_id=submission_id,
                score=score,
                feedback_text=full_feedback,
                weaknesses="Speaking",
                created_at=datetime.now()
            )

            # Google sunucusundaki geçici dosyayı temizleyelim (Opsiyonel ama iyi pratik)
            try:
                uploaded_file.delete()
            except:
                pass

            return ev_result, mistakes_list

        except Exception as e:
            print(f"⚠️ Speaking Error: {e}")
            # Hata dönerse sistem çökmesin, boş sonuç dönsün
            dummy_ev = EvaluationResult(
                id=str(uuid.uuid4()), submission_id=submission_id, score=0, 
                feedback_text=f"Ses analizi sırasında hata oluştu: {str(e)}", 
                weaknesses="System Error", created_at=datetime.now()
            )
            return dummy_ev, []    
    # ---------------------------------------------------------
    # QUIZ FEEDBACK (KISA – STRUCTURED)
    # ---------------------------------------------------------
    async def generate_mcq_feedback_tr_structured(
        self, score: int, mistakes: list
    ):
        if not GOOGLE_API_KEY:
            return {
                "summary": "AI sistemi şu anda kapalı.",
                "question_feedback": []
            }

        prompt = f"""
ROLE: English Teacher for Turkish students.

RULES:
- Short explanations
- Question based
- Max 2-3 sentences
- Turkish

OUTPUT (JSON ONLY):
{{
  "summary": "Short encouraging summary",
  "question_feedback": [
    {{
      "question": "...",
      "your_answer": "...",
      "correct_answer": "...",
      "explanation": "Short rule explanation"
    }}
  ]
}}

DATA:
Score: {score}
Mistakes: {mistakes}
"""
        try:
            # 🔥 YENİ FONKSİYONU KULLANIYORUZ
            response = self._generate_content_safe(prompt)
            data = self._clean_json(response.text)

            if not data:
                return {
                    "summary": "Geri bildirim üretilemedi.",
                    "question_feedback": []
                }

            return data
        except Exception as e:
            print(f"Feedback generation error: {e}")
            return {
                "summary": "Hata oluştu.",
                "question_feedback": []
            }
    # AIService.py - UC7 Challenge Detection Mantığı
async def detect_learning_challenges(self, submissions: List[Submission], mistakes: List[Mistake]):
    """
    Döküman Sayfa 19: AI finds patterns where the student keeps failing. 
    """
    # 1- AI collects past submissions (Döküman Step 1) 
    if len(submissions) < 3: # Extension 2a: Not enough data 
        return "Analiz için daha fazla aktivite tamamlanmalı."

    # 2- It compares mistakes across activities (Döküman Step 2) 
    mistake_history = [m.description for m in mistakes]
    
    prompt = f"""
    ROLE: Language Learning Analyst.
    DATA: Student's recent mistakes: {mistake_history}
    
    TASK:
    - Identify repeated learning problems (Patterns). 
    - Determine which topic needs more practice (UC7 Goal). 
    - Create a short 'Challenge' title and a 'Recommendation'.
    
    FORMAT (JSON ONLY):
    {{
      "pattern_found": "Title of the challenge",
      "recommendation": "Advice for student",
      "priority": "High/Medium/Low"
    }}
    """
    # 4- System saves this info in the progress tracking module (Döküman Step 4) 
    response = self._generate_content_safe(prompt)
    return self._clean_json(response.text)

# ---------------------------------------------------------
# SINGLETON
# ---------------------------------------------------------
ai_service = AIService()