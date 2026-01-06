from .auth_service import auth_service
from .storage import storage
from fastapi import HTTPException

def seed_demo_users():
    try:
        auth_service.register(
            "student@demo.com", "1234", "student", "Demo", "Student"
        )
    except HTTPException:
        pass  # zaten varsa geç

    try:
        auth_service.register(
            "teacher@demo.com", "1234", "teacher", "Demo", "Teacher"
        )
    except HTTPException:
        pass

    try: 
        auth_service.register(
            "admin@demo.com", "1234", "admin", "Demo", "Admin"
        )
    except HTTPException:   
        pass    

