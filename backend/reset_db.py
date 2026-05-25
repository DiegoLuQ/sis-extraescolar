import sys
import os

# Añadir el directorio actual al path para importar correctamente los módulos del backend
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal

def reset_database():
    ADMIN_ID = "ed3d24ac-e49f-4593-ba5c-e2c7010f10d7"
    db: Session = SessionLocal()
    try:
        print("Iniciando el proceso de limpieza completa de la base de datos...")
        
        # Deshabilitar verificación de claves foráneas temporalmente en MySQL
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        
        # Eliminar registros en orden jerárquico de dependencias
        print("1. Eliminando alertas de inconsistencia...")
        db.execute(text("DELETE FROM alertas_inconsistencia;"))
        
        print("2. Eliminando asistencias...")
        db.execute(text("DELETE FROM asistencias;"))
        
        print("3. Eliminando sesiones...")
        db.execute(text("DELETE FROM sesiones;"))
        
        print("4. Eliminando inscripciones...")
        db.execute(text("DELETE FROM inscripciones;"))
        
        print("5. Eliminando horarios satélite de talleres...")
        db.execute(text("DELETE FROM taller_horarios;"))
        
        print("6. Eliminando talleres...")
        db.execute(text("DELETE FROM talleres;"))
        
        print("7. Eliminando alumnos...")
        db.execute(text("DELETE FROM alumnos;"))
        
        print(f"8. Eliminando usuarios (preservando cuenta de administrador con ID: {ADMIN_ID})...")
        db.execute(text("DELETE FROM usuarios WHERE id != :admin_id;"), {"admin_id": ADMIN_ID})
        
        print("9. Eliminando permisos...")
        db.execute(text("DELETE FROM permisos;"))
        
        print("10. Eliminando roles...")
        db.execute(text("DELETE FROM roles;"))
        
        print("11. Eliminando colegios...")
        db.execute(text("DELETE FROM colegios;"))
        
        # Confirmar los cambios
        db.commit()
        
        # Rehabilitar verificación de claves foráneas
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        
        print("\n¡Limpieza ejecutada con éxito! La base de datos está vacía, conservando únicamente la cuenta del Administrador Global.")
        
    except Exception as e:
        db.rollback()
        print(f"\nOcurrió un error durante la ejecución del script: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
