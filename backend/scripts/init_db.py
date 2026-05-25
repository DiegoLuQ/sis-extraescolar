import sys
import os
import subprocess

# Add the current directory to sys.path to allow imports from core and modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal
from core.security import get_password_hash
from modules.colegios.models import Colegio
from modules.usuarios.models import Usuario, RolEnum

def run_migrations():
    """Ejecuta las migraciones de Alembic."""
    print(">>> Corriendo migraciones con Alembic...")
    try:
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_exe = os.path.join(backend_dir, "venv", "Scripts", "alembic.exe")

        if not os.path.exists(alembic_exe):
            alembic_exe = "alembic"

        print(f">>> Usando ejecutable: {alembic_exe}")
        subprocess.run([alembic_exe, "upgrade", "head"], check=True, cwd=backend_dir)
        print(">>> Migraciones completadas.")
    except Exception as e:
        print(f"Error al correr migraciones: {e}")
        sys.exit(1)

def setup_initial_data():
    """Configura los datos iniciales: Colegio por defecto y Superusuario."""
    print(">>> Configurando datos iniciales...")
    db = SessionLocal()
    try:
        # 1. Verificar o Crear Colegio por defecto
        colegio = db.query(Colegio).filter(Colegio.nombre_colegio == "Colegio Administrador Sistema").first()
        if not colegio:
            print(">>> Creando colegio por defecto...")
            colegio = Colegio(
                nombre_colegio="Colegio Administrador Sistema",
                rut_sostenedor="99.999.999-9",
                is_active=True
            )
            db.add(colegio)
            db.commit()
            db.refresh(colegio)
            print(f">>> Colegio creado con ID: {colegio.id}")
        else:
            print(f">>> Colegio por defecto ya existe (ID: {colegio.id})")

        # 2. Verificar o Crear Superusuario admin/admin123
        admin = db.query(Usuario).filter(Usuario.nombre == "admin").first()
        if not admin:
            print(">>> Creando superusuario admin...")
            admin = Usuario(
                colegio_id=colegio.id,
                nombre="admin",
                password_hash=get_password_hash("admin123"),
                rol=RolEnum.admin,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print(">>> Superusuario creado con éxito: User: admin | Pass: admin123")
        else:
            print(">>> El superusuario 'admin' ya existe.")

    except Exception as e:
        print(f"!!! Error durante la inicialización de datos: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migrations()
    setup_initial_data()
    print("\n>>> PROCESO DE INICIALIZACIÓN FINALIZADO CON ÉXITO.")
