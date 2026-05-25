from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from typing import Optional, List
from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
from modules.inscripciones.schemas import InscripcionCreate, InscripcionUpdate
from modules.talleres.models import Taller
from modules.usuarios.models import Usuario
from modules.alumnos.models import Alumno
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia, EstadoAsistenciaEnum
from modules.alumnos.crud import format_rut


def get_inscripciones(db: Session, escuela_id: UUID = None, taller_id: Optional[UUID] = None):
    query = db.query(Inscripcion)
    if escuela_id:
        query = query.filter(Inscripcion.colegio_id == str(escuela_id))
    if taller_id:
        query = query.filter(Inscripcion.taller_id == str(taller_id))
    return query.all()


def get_inscripcion_by_id(db: Session, inscripcion_id: UUID, escuela_id: str = None):
    query = db.query(Inscripcion).filter(Inscripcion.id == str(inscripcion_id))
    if escuela_id:
        query = query.filter(Inscripcion.colegio_id == str(escuela_id))
    return query.first()


def get_inscripcion_by_alumno_taller(db: Session, alumno_id: UUID, taller_id: UUID, escuela_id: UUID):
    return db.query(Inscripcion).filter(
        Inscripcion.alumno_id == str(alumno_id),
        Inscripcion.taller_id == str(taller_id),
        Inscripcion.colegio_id == str(escuela_id),
        Inscripcion.estado == EstadoInscripcionEnum.inscrito
    ).first()


def create_inscripcion(db: Session, inscripcion: InscripcionCreate, escuela_id: UUID):
    existente = get_inscripcion_by_alumno_taller(db, inscripcion.alumno_id, inscripcion.taller_id, escuela_id)
    if existente:
        raise ValueError("El alumno ya está inscrito en este taller")
    
    taller = db.query(Taller).filter(Taller.id == str(inscripcion.taller_id)).first()
    if not taller:
        raise ValueError("Taller no encontrado")
    
    inscripciones_actuales = db.query(Inscripcion).filter(
        Inscripcion.taller_id == str(inscripcion.taller_id),
        Inscripcion.estado == EstadoInscripcionEnum.inscrito
    ).count()
    
    if inscripciones_actuales >= taller.cupos_maximos:
        raise ValueError("No hay cupos disponibles en este taller")
    
    db_inscripcion = Inscripcion(
        taller_id=str(inscripcion.taller_id),
        alumno_id=str(inscripcion.alumno_id),
        colegio_id=str(escuela_id),
        estado=EstadoInscripcionEnum.inscrito
    )
    db.add(db_inscripcion)
    db.commit()
    db.refresh(db_inscripcion)
    return db_inscripcion


def update_inscripcion(db: Session, inscripcion_id: UUID, inscripcion: InscripcionUpdate, escuela_id: UUID):
    db_inscripcion = get_inscripcion_by_id(db, inscripcion_id, escuela_id)
    if db_inscripcion and inscripcion.estado:
        db_inscripcion.estado = EstadoInscripcionEnum[inscripcion.estado.lower()]
        db.commit()
        db.refresh(db_inscripcion)
    return db_inscripcion


def get_talleres_resumen(db: Session, colegio_id: Optional[str] = None, usuario_id: str = None, rol: str = None):
    """
    Obtiene un resumen de todos los talleres para la vista de tarjetas.
    """
    query = db.query(Taller).filter(Taller.is_active == True)
    if colegio_id and colegio_id != "None":
        query = query.filter(Taller.colegio_id == colegio_id)
    
    if rol == "monitor" and usuario_id:
        query = query.filter(Taller.profesor_id == str(usuario_id))
        
    talleres = query.all()
    resumen = []
    
    for t in talleres:
        profesor = db.query(Usuario).filter(Usuario.id == t.profesor_id).first()
        inscritos_count = db.query(Inscripcion).filter(
            Inscripcion.taller_id == t.id,
            Inscripcion.estado == EstadoInscripcionEnum.inscrito
        ).count()
        
        resumen.append({
            "id": t.id,
            "nombre_taller": t.nombre_taller,
            "coordinador_nombre": (profesor.nombre_2 or profesor.nombre) if profesor else "No asignado",
            "dia": t.dia,
            "hora_inicio": t.hora_inicio,
            "hora_fin": t.hora_fin,
            "cupos_maximos": t.cupos_maximos,
            "inscritos_count": inscritos_count
        })
        
    return resumen


def get_taller_inscripciones_stats(db: Session, taller_id: str, colegio_id: Optional[str] = None):
    """
    Obtiene la lista de alumnos inscritos en un taller con su % de asistencia.
    """
    query = db.query(Inscripcion, Alumno).join(
        Alumno, Inscripcion.alumno_id == Alumno.id
    ).filter(
        Inscripcion.taller_id == taller_id
    )
    
    if colegio_id and colegio_id != "None":
        query = query.filter(Inscripcion.colegio_id == colegio_id)
        
    inscripciones = query.all()
    
    # Contar sesiones totales del taller
    total_sesiones = db.query(Sesion).filter(Sesion.taller_id == taller_id).count()
    
    stats = []
    for ins, alu in inscripciones:
        # Contar asistencias del alumno en este taller (presente o atraso)
        asistencias_validas = db.query(Asistencia).join(
            Sesion, Asistencia.sesion_id == Sesion.id
        ).filter(
            Sesion.taller_id == taller_id,
            Asistencia.alumno_id == alu.id,
            Asistencia.estado_asistencia.in_([EstadoAsistenciaEnum.presente, EstadoAsistenciaEnum.atraso])
        ).count()
        
        porcentaje = (asistencias_validas / total_sesiones * 100) if total_sesiones > 0 else 0
        
        stats.append({
            "inscripcion_id": ins.id,
            "alumno_id": alu.id,
            "nombre_alumno": alu.nombre_completo,
            "rut_alumno": alu.rut,
            "curso_alumno": alu.curso,
            "estado": ins.estado,
            "porcentaje_asistencia": round(porcentaje, 1),
            "total_sesiones": total_sesiones,
            "asistencias_contadas": asistencias_validas
        })
        
    return stats


def export_taller_inscripciones(db: Session, taller_id: str, colegio_id: Optional[str] = None):
    """
    Genera un DataFrame con los datos de inscripciones para exportar a Excel.
    """
    stats = get_taller_inscripciones_stats(db, taller_id, colegio_id)
    
    data = []
    for s in stats:
        data.append({
            "Nombre Alumno": s["nombre_alumno"],
            "RUT": s["rut_alumno"],
            "Curso": s["curso_alumno"],
            "Estado": s["estado"],
            "Asistencias": s["asistencias_contadas"],
            "Sesiones Totales": s["total_sesiones"],
            "% Asistencia": s["porcentaje_asistencia"]
        })
    
    return pd.DataFrame(data)


def bulk_upsert_inscripciones(db: Session, taller_id: str, colegio_id: str, data: List[dict]):
    """
    data es una lista de diccionarios con la clave 'RUT ALUMNO'
    """
    stats = {"inserted": 0, "skipped": 0, "errors": 0}
    
    taller = db.query(Taller).filter(Taller.id == taller_id, Taller.colegio_id == colegio_id).first()
    if not taller:
        raise ValueError("Taller no encontrado")
        
    for item in data:
        try:
            rut_input = item.get("RUT ALUMNO")
            if not rut_input:
                stats["errors"] += 1
                continue
                
            rut = format_rut(str(rut_input))
            
            # Buscar alumno
            alumno = db.query(Alumno).filter(Alumno.rut == rut, Alumno.colegio_id == colegio_id).first()
            if not alumno:
                stats["errors"] += 1
                continue
            
            # Verificar si ya está inscrito
            existente = db.query(Inscripcion).filter(
                Inscripcion.alumno_id == alumno.id,
                Inscripcion.taller_id == taller_id,
                Inscripcion.estado == EstadoInscripcionEnum.inscrito
            ).first()
            
            if existente:
                stats["skipped"] += 1
                continue
            
            # Verificar cupo
            inscritos_actuales = db.query(Inscripcion).filter(
                Inscripcion.taller_id == taller_id,
                Inscripcion.estado == EstadoInscripcionEnum.inscrito
            ).count()
            
            if inscritos_actuales >= taller.cupos_maximos:
                stats["errors"] += 1 # O "full"? Por ahora error.
                continue
                
            # Crear inscripción
            nueva = Inscripcion(
                taller_id=taller_id,
                alumno_id=alumno.id,
                colegio_id=colegio_id,
                estado=EstadoInscripcionEnum.inscrito
            )
            db.add(nueva)
            stats["inserted"] += 1
            
        except Exception:
            stats["errors"] += 1
            
    db.commit()
    return stats
