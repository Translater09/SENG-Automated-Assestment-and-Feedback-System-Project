 Automated Assessment and Feedback System (AAFS)

An AI-powered web application designed to automatically evaluate student submissions in speaking, writing, and quizzes, and provide structured feedback.

 Overview

AAFS is a modular system that processes different types of user inputs and generates evaluation results using backend logic and AI-based analysis.

The system is designed with a clear separation of concerns:
- Frontend: User interaction
- Backend: API handling and evaluation logic
- AI Module: Assessment and scoring

---

🧠 Features

 🎤 Speaking Evaluation
- Accepts speech/text-based submissions
- Performs analysis on user responses
- Generates feedback and scoring

✍️ Writing Evaluation
- Analyzes written submissions
- Evaluates structure, clarity, and language usage
- Produces detailed feedback

 📝 Quiz Module
- Handles objective-type questions
- Performs automatic answer validation
- Generates instant scores

⚡ Feedback System
- Produces both score and qualitative feedback
- Stores results for later retrieval

---

 ⚙️ System Architecture

 1. Submission Layer
- Users submit data via frontend interface
- Requests are sent to backend through REST API

 2. Processing Layer
- Backend validates incoming data
- Routes input to appropriate evaluation module

 3. Evaluation Layer
- Speaking: speech/text analysis
- Writing: NLP-based evaluation
- Quiz: rule-based answer checking

 4. Result Layer
- Scores and feedback are generated
- Results are stored and returned to user

---

🛠️ Technologies

- **Backend:** FastAPI, Python
- **Frontend:** Node.js, npm
- **Server:** Uvicorn
- **Concepts:** API Design, Modular Architecture, AI-based Evaluation

---

## ▶️ Running the Project

### Backend
```bash
uvicorn app.main:app --reload


