print("🔥 init_db.py ÇALIŞTI")

from .database import engine, Base

def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ MSSQL tabloları başarıyla oluşturuldu.")

if __name__ == "__main__":
    init_db()
