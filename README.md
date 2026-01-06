# Automated Assessment and Feedback System (AAFS)

An AI-powered web application that automatically evaluates **Speaking**, **Writing**, and **Quiz** submissions and provides instant feedback to students.

---

##  Features

-  **Speaking Evaluation**
  - Speech-based submissions
  - AI-driven feedback and scoring

-  **Writing Evaluation**
  - Text submissions
  - Content, structure, and language analysis

-  **Quiz Module**
  - Objective questions
  - Automatic scoring

-  **Instant Feedback**
  - Score + detailed feedback
  - Stored results for later review



- Frontend handles user interaction
- Backend handles all logic and evaluation
- AI module performs assessment
- Results are stored and returned to users

---

## ⚙️ How the Code Works

### 1️⃣ Submission Flow
1. User selects **Speaking**, **Writing**, or **Quiz**
2. Submission is sent to backend via API
3. Backend validates and processes input

---

### 2️⃣ Evaluation Logic
- Speaking → speech/text analysis
- Writing → content & language evaluation
- Quiz → automatic answer checking

Each module produces:
- Score
- Feedback text

---

### 3️⃣ Result Handling
- Evaluation results are saved
- User can view feedback instantly
- Results can be reloaded later

---



## ▶️ How to Run the Project

### 🔹 Backend

```bash
uvicorn app.main:app --reload

### 🔹 Frontend
npm install
npm run dev



