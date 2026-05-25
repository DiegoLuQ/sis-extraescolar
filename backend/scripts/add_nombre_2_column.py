from sqlalchemy import text
from core.database import SessionLocal

def migrate():
    db = SessionLocal()
    try:
        print("Adding 'nombre_2' column to 'usuarios' table...")
        db.execute(text("ALTER TABLE usuarios ADD COLUMN nombre_2 VARCHAR(255) AFTER nombre"))
        
        print("Copying 'nombre' to 'nombre_2' for existing users...")
        db.execute(text("UPDATE usuarios SET nombre_2 = nombre"))
        
        db.commit()
        print("Migration successful!")
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
