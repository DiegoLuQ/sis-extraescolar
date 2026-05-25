from core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Adding 'monitor' to ENUM...")
    db.execute(text("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin', 'monitor', 'coordinador', 'extraescolar') NOT NULL"))
    print("Updating existing rows...")
    db.execute(text("UPDATE usuarios SET rol = 'monitor' WHERE rol = 'extraescolar'"))
    print("Removing 'extraescolar' from ENUM...")
    db.execute(text("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin', 'monitor', 'coordinador') NOT NULL"))
    db.commit()
    print("Migration successful!")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
