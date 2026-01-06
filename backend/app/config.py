# Dosya: backend/app/config.py
import os
from dotenv import load_dotenv
import google.generativeai as genai

# .env dosyasını yükle
load_dotenv()

GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
DATA_FILE = os.getenv("DATA_FILE", "data.json")
# Upload klasör yolu
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# API Key varsa Gemini'yi başlat
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    # Key yoksa konsola uyarı bas, ama programın çökmesini engellemek için variable'ı tanımlı tut
    print("UYARI: .env dosyasında 'GEMINI_API_KEY' bulunamadı! AI çalışmayabilir.")