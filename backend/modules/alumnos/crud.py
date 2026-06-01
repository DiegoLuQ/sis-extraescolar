from sqlalchemy.orm import Session
from uuid import UUID
from modules.alumnos.models import Alumno
from modules.alumnos.schemas import AlumnoCreate, AlumnoUpdate
import re

def format_rut(rut: str) -> str:
    """
    Limpia el RUT de puntos y espacios, lo pasa a mayúsculas y 
    asegura que tenga el guión antes del dígito verificador.
    Ejemplo: "18.899.4795" -> "18899479-5"
    """
    if not rut:
        return rut
    
    # Limpiar caracteres no deseados
    clean_rut = re.sub(r'[^0-9kK]', '', str(rut))
    
    if len(clean_rut) < 2:
        return clean_rut
    
    # Separar cuerpo y dígito verificador
    cuerpo = clean_rut[:-1]
    dv = clean_rut[-1].upper()
    
    return f"{cuerpo}-{dv}"


def get_alumnos(db: Session, colegio_id: UUID = None, skip: int = 0, limit: int = 100, usuario_id: str = None, rol: str = None, taller_id: UUID = None, for_enrollment: bool = False):
    from modules.talleres.models import Taller
    from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum

    query = db.query(Alumno).filter(Alumno.is_active == True)
    if colegio_id:
        query = query.filter(Alumno.colegio_id == str(colegio_id))

    if taller_id:
        query = query.join(Inscripcion, Inscripcion.alumno_id == Alumno.id)\
                     .filter(Inscripcion.taller_id == str(taller_id))\
                     .filter(Inscripcion.estado == EstadoInscripcionEnum.inscrito)

    if rol == "monitor" and usuario_id and not for_enrollment:
        if not taller_id:
            query = query.join(Inscripcion, Inscripcion.alumno_id == Alumno.id)\
                         .join(Taller, Taller.id == Inscripcion.taller_id)\
                         .filter(Taller.profesor_id == str(usuario_id))\
                         .filter(Inscripcion.estado == EstadoInscripcionEnum.inscrito)
        else:
            taller_pertence = db.query(Taller).filter(Taller.id == str(taller_id), Taller.profesor_id == str(usuario_id)).first()
            if not taller_pertence:
                return []

    return query.distinct().offset(skip).limit(limit).all()


def get_alumno_by_id(db: Session, alumno_id: UUID, colegio_id: str = None):
    query = db.query(Alumno).filter(Alumno.id == str(alumno_id))
    if colegio_id:
        query = query.filter(Alumno.colegio_id == str(colegio_id))
    return query.first()


def get_alumno_by_rut(db: Session, rut: str, colegio_id: str = None):
    formatted_rut = format_rut(rut)
    query = db.query(Alumno).filter(Alumno.rut == formatted_rut)
    if colegio_id:
        query = query.filter(Alumno.colegio_id == str(colegio_id))
    return query.first()


def create_alumno(db: Session, alumno: AlumnoCreate, colegio_id: UUID):
    data = alumno.model_dump()
    if data.get("rut"):
        data["rut"] = format_rut(data["rut"])
    db_alumno = Alumno(**data, colegio_id=str(colegio_id))
    db.add(db_alumno)
    db.commit()
    db.refresh(db_alumno)
    return db_alumno


def update_alumno(db: Session, alumno_id: UUID, alumno: AlumnoUpdate, colegio_id: UUID):
    db_alumno = get_alumno_by_id(db, alumno_id, colegio_id)
    if db_alumno:
        data = alumno.model_dump(exclude_unset=True)
        if "rut" in data:
            data["rut"] = format_rut(data["rut"])
        for key, value in data.items():
            setattr(db_alumno, key, value)
        db.commit()
        db.refresh(db_alumno)
    return db_alumno


def delete_alumno(db: Session, alumno_id: UUID, colegio_id: UUID):
    db_alumno = get_alumno_by_id(db, alumno_id, colegio_id)
    if db_alumno:
        setattr(db_alumno, "is_active", False)
        db.commit()
        db.refresh(db_alumno)
    return db_alumno

def bulk_upsert_alumnos(db: Session, alumnos_data: list, colegio_id: str):
    """
    Inserta o actualiza masivamente una lista de alumnos utilizando O(1) lookup en memoria.
    alumnos_data = [{'rut': '...', 'nombre_completo': '...', 'curso': '...'}, ...]
    """
    stats = {"inserted": 0, "updated": 0, "errors": 0}
    
    # Pre-cargar todos los alumnos existentes del colegio con bypass global de filtros
    existing_alumnos = (
        db.query(Alumno)
        .execution_options(skip_tenant_filter=True)
        .filter(Alumno.colegio_id == str(colegio_id))
        .all()
    )
    existing_map = {a.rut: a for a in existing_alumnos if a.rut}
    
    for item in alumnos_data:
        try:
            rut = format_rut(item.get("rut"))
            nombre = item.get("nombre_completo")
            curso = item.get("curso")
            if not rut or not nombre or not curso:
                stats["errors"] += 1
                continue
            
            if rut in existing_map:
                existing = existing_map[rut]
                # Si existe, actualizamos nombre y curso para consistencia, y reactivamos si estaba borrado
                if existing.curso != curso or existing.nombre_completo != nombre or not existing.is_active:
                    existing.curso = curso
                    existing.nombre_completo = nombre
                    existing.is_active = True
                    stats["updated"] += 1
            else:
                new_alumno = Alumno(
                    rut=rut,
                    nombre_completo=nombre,
                    curso=curso,
                    colegio_id=colegio_id,
                    is_active=True
                )
                db.add(new_alumno)
                # Inmediatamente lo guardamos en el mapa para evitar registros duplicados si el mismo rut viene repetido en el Excel/BD
                existing_map[rut] = new_alumno
                stats["inserted"] += 1
        except Exception:
            stats["errors"] += 1
    
    db.commit()
    return stats

def get_alumnos_stats(db: Session, colegio_id: str = None, usuario_id: str = None, rol: str = None):
    from sqlalchemy import func
    from modules.talleres.models import Taller
    from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
    
    if rol == "monitor" and usuario_id:
        # Conteo para monitores: alumnos únicos en sus talleres
        inscritos = db.query(func.count(func.distinct(Alumno.id)))\
                      .join(Inscripcion, Inscripcion.alumno_id == Alumno.id)\
                      .join(Taller, Taller.id == Inscripcion.taller_id)\
                      .filter(Alumno.is_active == True, Taller.profesor_id == str(usuario_id), Inscripcion.estado == EstadoInscripcionEnum.inscrito)\
                      .scalar()
        
        retirados = db.query(func.count(func.distinct(Alumno.id)))\
                      .join(Inscripcion, Inscripcion.alumno_id == Alumno.id)\
                      .join(Taller, Taller.id == Inscripcion.taller_id)\
                      .filter(Alumno.is_active == True, Taller.profesor_id == str(usuario_id), Inscripcion.estado == EstadoInscripcionEnum.retirado)\
                      .scalar()
        total = db.query(func.count(func.distinct(Alumno.id)))\
                      .join(Inscripcion, Inscripcion.alumno_id == Alumno.id)\
                      .join(Taller, Taller.id == Inscripcion.taller_id)\
                      .filter(Alumno.is_active == True, Taller.profesor_id == str(usuario_id))\
                      .scalar()
    else:
        # Conteo para admin: total en el colegio
        total = db.query(func.count(Alumno.id)).filter(Alumno.is_active == True)
        if colegio_id:
            total = total.filter(Alumno.colegio_id == str(colegio_id))
        total = total.scalar()

        inscritos = db.query(func.count(func.distinct(Inscripcion.alumno_id)))\
                      .filter(Inscripcion.estado == EstadoInscripcionEnum.inscrito)
        if colegio_id:
            inscritos = inscritos.filter(Inscripcion.colegio_id == str(colegio_id))
        inscritos = inscritos.scalar()

        retirados = db.query(func.count(func.distinct(Inscripcion.alumno_id)))\
                      .filter(Inscripcion.estado == EstadoInscripcionEnum.retirado)
        if colegio_id:
            retirados = retirados.filter(Inscripcion.colegio_id == str(colegio_id))
        retirados = retirados.scalar()

    return {
        "inscritos": inscritos or 0,
        "retirados": retirados or 0,
        "total": total or 0
    }
