import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from core.config import settings
from modules.colegios.models import Colegio
from modules.alumnos.crud import bulk_upsert_alumnos

logger = logging.getLogger(__name__)

COURSE_MAP = {
    "Transición 1er Nivel A": "PKºA",
    "Transición 1er Nivel 2": "PKºB",
    "Transición 1er Nivel B": "PKºB",
    "Transición 2º Nivel A": "KºA",
    "Transición 2º Nivel B": "KºB",
}


def get_grade_number(text: str) -> str:
    t = text.lower()
    if "primer" in t or "1er" in t or "1º" in t or "1°" in t:
        return "1"
    if "segund" in t or "2do" in t or "2º" in t or "2°" in t:
        return "2"
    if "tercer" in t or "3er" in t or "3º" in t or "3°" in t:
        return "3"
    if "cuart" in t or "4to" in t or "4º" in t or "4°" in t:
        return "4"
    if "quint" in t or "5to" in t or "5º" in t or "5°" in t:
        return "5"
    if "sext" in t or "6to" in t or "6º" in t or "6°" in t:
        return "6"
    if "séptim" in t or "septim" in t or "7mo" in t or "7º" in t or "7°" in t:
        return "7"
    if "octav" in t or "8vo" in t or "8º" in t or "8°" in t:
        return "8"
    return ""


def get_letter(text: str) -> str:
    if text.strip().endswith("2"):
        return "B"
    words = text.split()
    if words:
        last_word = words[-1].upper()
        if last_word in ["A", "B", "C"]:
            return last_word
        if last_word[-1] in ["A", "B", "C"]:
            return last_word[-1]
    return ""


def normalize_curso(curso_str: str) -> str:
    if not curso_str:
        return ""

    t_clean = curso_str.split("|")[0].strip()

    for key, val in COURSE_MAP.items():
        if t_clean.lower() == key.lower():
            return val

    t_lower = t_clean.lower()

    if "transición 1" in t_lower or "1er nivel" in t_lower or "pk" in t_lower:
        letter = get_letter(t_clean) or "A"
        return f"PKº{letter}"
    if "transición 2" in t_lower or "2º nivel" in t_lower or "2do nivel" in t_lower or t_lower.startswith("k"):
        letter = get_letter(t_clean) or "A"
        return f"Kº{letter}"

    is_media = "media" in curso_str.lower() or "ºm" in t_lower or "°m" in t_lower

    grade = get_grade_number(t_clean)
    letter = get_letter(t_clean)

    if grade and letter:
        if is_media:
            return f"{grade}ºM{letter}"
        else:
            return f"{grade}º{letter}"

    return t_clean


def fetch_external_students(db_url: str) -> list:
    """
    Se conecta a la base de datos MySQL externa, realiza el JOIN entre
    alumnos y cursos, y retorna la lista normalizada de estudiantes.
    """
    engine = create_engine(db_url, pool_pre_ping=True)
    students = []
    with engine.connect() as conn:
        try:
            # Intentamos con c.nombre como identificador del curso
            query = text("""
                SELECT a.rut, a.nombre, c.nombre AS curso_nombre
                FROM alumnos a
                JOIN cursos c ON a.curso_id = c.id
            """)
            result = conn.execute(query)
        except Exception as e:
            logger.warning(f"Fallo consulta con c.nombre en {db_url}, intentando fallback con c.curso: {e}")
            query = text("""
                SELECT a.rut, a.nombre, c.curso AS curso_nombre
                FROM alumnos a
                JOIN cursos c ON a.curso_id = c.id
            """)
            result = conn.execute(query)

        for row in result:
            rut = row[0]
            nombre = row[1]
            curso_raw = row[2]
            if not rut:
                continue
            students.append({
                "rut": str(rut).strip(),
                "nombre_completo": str(nombre).strip() if nombre else "",
                "curso": normalize_curso(str(curso_raw)) if curso_raw else "",
            })
    return students


def run_external_sync(db: Session, caller_colegio_id: str = None, caller_rol: str = None) -> dict:
    """
    Ejecuta el flujo ETL completo para los establecimientos configurados.
    Retorna un diccionario con los resultados de sincronización.
    """
    results = {}

    # Definir los orígenes y sus identificadores de búsqueda local
    targets = [
        {"key": "macaya", "url": settings.EXTERNAL_DB_MC_URL, "label": "Colegio Macaya"},
        {"key": "portales", "url": settings.EXTERNAL_DB_DP_URL, "label": "Colegio Diego Portales"},
    ]

    for target in targets:
        label = target["label"]
        db_url = target["url"]
        substring = target["key"]

        # Buscar el colegio en la BD local sin filtros de tenant
        colegio = (
            db.query(Colegio)
            .execution_options(skip_tenant_filter=True)
            .filter(Colegio.nombre_colegio.ilike(f"%{substring}%"), Colegio.is_active == True)
            .first()
        )

        if not colegio:
            logger.warning(f"Establecimiento local para '{label}' (búsqueda: {substring}) no encontrado. Omitiendo.")
            results[label] = {"status": "error", "detail": "Colegio local no encontrado"}
            continue

        # Si el usuario no es admin, solo sincroniza su propio colegio asignado
        if caller_rol != "admin" and caller_colegio_id and str(colegio.id) != str(caller_colegio_id):
            logger.info(f"Omitiendo {label} porque no pertenece al rol del usuario actual.")
            continue

        try:
            logger.info(f"Iniciando extracción desde BD externa para {label}...")
            students_data = fetch_external_students(db_url)
            logger.info(f"Extraídos {len(students_data)} alumnos desde {label}. Iniciando Upsert local...")

            stats = bulk_upsert_alumnos(db, students_data, str(colegio.id))
            results[label] = {
                "status": "success",
                "extracted": len(students_data),
                "stats": stats,
            }
        except Exception as e:
            logger.exception(f"Error sincronizando {label} desde {db_url}")
            results[label] = {"status": "error", "detail": str(e)}

    return results
