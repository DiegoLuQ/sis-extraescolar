import sys
import os

# Añadir el directorio actual al path para poder importar los módulos
sys.path.append(os.getcwd())

from core.database import engine, Base
# Importar todos los modelos para que Base los conozca
from modules.colegios.models import Colegio
from modules.usuarios.models import Usuario
from modules.alumnos.models import Alumno
from modules.talleres.models import Taller
from modules.inscripciones.models import Inscripcion
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia, AlertaInconsistencia
from modules.correos.models import CorreoReporte

print("Creando tablas en la base de datos...")
Base.metadata.create_all(bind=engine)
print("Tablas creadas exitosamente.")
