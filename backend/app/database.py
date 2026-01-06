from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = (
    "mssql+pyodbc://localhost\\SQLEXPRESS/AAFS_DB"
    "?driver=ODBC+Driver+17+for+SQL+Server"
    "&trusted_connection=yes"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# 🔥 KRİTİK SATIR
from . import db_models
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
