from sqlalchemy.orm import Session
from uuid import UUID
from modules.sesiones.models import Sesion
from modules.sesiones.schemas import SesionCreate


def get_sesiones(db: Session, colegio_id: UUID = None, taller_id: UUID = None, usuario_id: str = None, rol: str = None):
    from modules.talleres.models import Taller
    from modules.asistencias.models import Asistencia, EstadoAsistenciaEnum
    from modules.inscripciones.models import Inscripcion
    from sqlalchemy import func

    query = db.query(Sesion)
    
    if colegio_id:
        query = query.filter(Sesion.colegio_id == colegio_id)
    
    if taller_id:
        query = query.filter(Sesion.taller_id == taller_id)
        
    if rol == "monitor" and usuario_id:
        query = query.join(Taller, Sesion.taller_id == Taller.id).filter(Taller.profesor_id == usuario_id)
        
    sesiones = query.order_by(Sesion.fecha_sesion.desc()).all()
    
    # Enriquecer sesiones con estadísticas
    result = []
    for s in sesiones:
        taller = db.query(Taller).filter(Taller.id == s.taller_id).first()
        
        # Conteo de asistencias
        asistencias = db.query(Asistencia).filter(Asistencia.sesion_id == s.id).all()
        presentes = len([a for a in asistencias if a.estado_asistencia in ["presente", "atraso"]])
        ausentes = len([a for a in asistencias if a.estado_asistencia == "ausente"])
        
        # Conteo de inscritos (en ese momento del taller)
        inscritos = db.query(Inscripcion).filter(
            Inscripcion.taller_id == s.taller_id,
            Inscripcion.estado == "inscrito"
        ).count()
        
        # Cupos disponibles
        cupos_max = taller.cupos_maximos if taller else 0
        disponibles = max(0, cupos_max - inscritos)
        
        s_dict = {
            "id": s.id,
            "taller_id": s.taller_id,
            "fecha_sesion": s.fecha_sesion,
            "tematica": s.tematica,
            "colegio_id": s.colegio_id,
            "creado_por": s.creado_por,
            "total_presentes": presentes,
            "total_ausentes": ausentes,
            "total_inscritos": inscritos,
            "cupos_disponibles": disponibles,
            "nombre_taller": taller.nombre_taller if taller else "Desconocido",
            "bloqueada": getattr(s, "bloqueada", False)
        }
        result.append(s_dict)
        
    return result


def toggle_bloqueo_sesion(db: Session, sesion_id: UUID, bloqueada: bool, colegio_id: str = None):
    db_sesion = get_sesion_by_id(db, sesion_id, colegio_id)
    if db_sesion:
        if bloqueada:
            # Cerrar la sesión actual y todas las anteriores del mismo taller
            sesiones_a_cerrar = db.query(Sesion).filter(
                Sesion.taller_id == db_sesion.taller_id,
                Sesion.fecha_sesion <= db_sesion.fecha_sesion
            )
            if colegio_id:
                sesiones_a_cerrar = sesiones_a_cerrar.filter(Sesion.colegio_id == str(colegio_id))
            
            for s in sesiones_a_cerrar.all():
                s.bloqueada = True
        else:
            # Reabrir solo esta sesión
            db_sesion.bloqueada = False
            
        db.commit()
        db.refresh(db_sesion)
    return db_sesion


def get_sesion_by_id(db: Session, sesion_id: UUID, colegio_id: str = None):
    query = db.query(Sesion).filter(Sesion.id == str(sesion_id))
    if colegio_id:
        query = query.filter(Sesion.colegio_id == str(colegio_id))
    return query.first()


def create_sesion(db: Session, sesion: SesionCreate, colegio_id: str, usuario_id: str):
    from modules.talleres.models import Taller
    
    active_colegio_id = str(colegio_id) if (colegio_id and colegio_id != "None") else None
    
    if not active_colegio_id:
        taller = db.query(Taller).filter(Taller.id == str(sesion.taller_id)).first()
        if taller:
            active_colegio_id = taller.colegio_id
            
    db_sesion = Sesion(
        **sesion.model_dump(), 
        colegio_id=active_colegio_id, 
        creado_por=str(usuario_id)
    )
    db.add(db_sesion)
    db.commit()
    db.refresh(db_sesion)
    return db_sesion
def delete_sesion(db: Session, sesion_id: UUID, colegio_id: str = None):
    db_sesion = get_sesion_by_id(db, sesion_id, colegio_id)
    if db_sesion:
        # Eliminar asistencias relacionadas
        from modules.asistencias.models import Asistencia
        db.query(Asistencia).filter(Asistencia.sesion_id == str(sesion_id)).delete()
        
        # Eliminar alertas de inconsistencia relacionadas
        from modules.asistencias.models import AlertaInconsistencia
        db.query(AlertaInconsistencia).filter(AlertaInconsistencia.sesion_id == str(sesion_id)).delete()
        
        # Eliminar sesión
        db.delete(db_sesion)
        db.commit()
        return True
    return False


def cierre_global_sesiones(db: Session, fecha: str, colegio_id: str) -> int:
    import datetime
    # Convertir a objeto date para asegurar comparación correcta si es necesario, o usar str directo
    # Asumiendo que fecha_sesion es una columna Date o String(YYYY-MM-DD)
    sesiones_a_cerrar = db.query(Sesion).filter(
        Sesion.colegio_id == str(colegio_id),
        Sesion.fecha_sesion <= fecha,
        Sesion.bloqueada != True
    ).all()
    
    count = 0
    for s in sesiones_a_cerrar:
        s.bloqueada = True
        count += 1
        
    if count > 0:
        db.commit()
    return count
