from core.database import engine
from sqlalchemy import text

def add_email_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN email VARCHAR(255) AFTER nombre_2"))
            conn.commit()
            print("Columna 'email' agregada exitosamente a la tabla 'usuarios'.")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("La columna 'email' ya existe.")
            else:
                print(f"Error al agregar la columna: {e}")

if __name__ == "__main__":
    add_email_column()
