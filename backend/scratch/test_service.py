import sqlalchemy
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from modules.sesiones.services import get_absent_students_from_school
from core.database import SessionLocal

def test_service():
    db = SessionLocal()
    sesion_id = "851ce52a-25b6-4b6f-a520-c3fc8c8302ac"
    # Need a colegio_id. Let's find it.
    colegio_id = db.execute(text("SELECT colegio_id FROM sesiones WHERE id = :id"), {"id": sesion_id}).scalar()
    print(f"Testing for session {sesion_id}, colegio {colegio_id}")
    
    result = get_absent_students_from_school(db, sesion_id, colegio_id)
    print("Absent students found:", result)
    db.close()

if __name__ == "__main__":
    test_service()
