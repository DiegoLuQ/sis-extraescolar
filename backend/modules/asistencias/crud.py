from sqlalchemy.orm import Session
from uuid import UUID
from modules.asistencias.models import Asistencia, EstadoAsistenciaEnum, AlertaInconsistencia, NotaComportamiento, TipoComportamientoEnum
from modules.asistencias.schemas import AsistenciaCreate, AsistenciaUpdate, NotaComportamientoCreate
from datetime import datetime


def get_asistencias(db: Session, colegio_id: str, sesion_id: UUID):
    query = db.query(Asistencia).filter(Asistencia.sesion_id == str(sesion_id))
    if colegio_id and colegio_id != "None":
        query = query.filter(Asistencia.colegio_id == str(colegio_id))
    return query.all()


def create_asistencia(db: Session, asistencia: AsistenciaCreate, colegio_id: UUID):
    db_asistencia = Asistencia(
        sesion_id=asistencia.sesion_id,
        alumno_id=asistencia.alumno_id,
        colegio_id=colegio_id,
        estado_asistencia=EstadoAsistenciaEnum[asistencia.estado_asistencia.lower()]
    )
    db.add(db_asistencia)
    db.commit()
    db.refresh(db_asistencia)
    return db_asistencia


def create_asistencias_bulk(db: Session, sesion_id: UUID, lista: list, colegio_id: str = None):
    # Si no viene colegio_id (Vista Global), lo obtenemos de la sesión
    from modules.sesiones.models import Sesion
    sesion = db.query(Sesion).filter(Sesion.id == str(sesion_id)).first()
    if not sesion:
        raise ValueError("Sesión no encontrada")
    
    active_colegio_id = str(colegio_id) if (colegio_id and colegio_id != "None") else sesion.colegio_id

    # Primero eliminar asistencias previas de esta sesión para evitar duplicados
    db.query(Asistencia).filter(
        Asistencia.sesion_id == str(sesion_id), 
        Asistencia.colegio_id == active_colegio_id
    ).delete()
    
    db_asistencias = []
    for item in lista:
        db_asistencia = Asistencia(
            sesion_id=str(sesion_id),
            alumno_id=item["alumno_id"],
            colegio_id=active_colegio_id,
            estado_asistencia=EstadoAsistenciaEnum[item["estado_asistencia"].lower()],
            observaciones=item.get("observaciones")
        )
        db.add(db_asistencia)
        db_asistencias.append(db_asistencia)
    
    
    # --- REGISTRAR HISTORIAL DE INCONSISTENCIAS ---
    from modules.sesiones.services import get_absent_students_from_school
    absent_ruts_data = get_absent_students_from_school(db, sesion_id, active_colegio_id)
    absent_ids = {a["alumno_id"] for a in absent_ruts_data}
    
    # Eliminar alertas previas de esta sesión para no duplicar si vuelven a guardar
    db.query(AlertaInconsistencia).filter(AlertaInconsistencia.sesion_id == str(sesion_id)).delete()

    for item in lista:
        if item["alumno_id"] in absent_ids and item["estado_asistencia"].lower() == "presente":
            nueva_alerta = AlertaInconsistencia(
                colegio_id=active_colegio_id,
                sesion_id=str(sesion_id),
                alumno_id=item["alumno_id"],
                fecha=sesion.fecha_sesion.isoformat(),
                creado_at=datetime.now().isoformat()
            )
            db.add(nueva_alerta)
    # ----------------------------------------------

    db.commit()
    for a in db_asistencias:
        db.refresh(a)
    return db_asistencias

def get_alertas_inconsistencia(db: Session, colegio_id: str):
    from modules.alumnos.models import Alumno
    from modules.sesiones.models import Sesion
    from modules.talleres.models import Taller
    
    query = db.query(
        AlertaInconsistencia.id,
        AlertaInconsistencia.colegio_id,
        AlertaInconsistencia.sesion_id,
        AlertaInconsistencia.alumno_id,
        AlertaInconsistencia.fecha,
        AlertaInconsistencia.tipo_alerta,
        AlertaInconsistencia.creado_at,
        Alumno.nombre_completo.label("nombre_alumno"),
        Taller.nombre_taller.label("nombre_taller")
    ).join(Alumno, Alumno.id == AlertaInconsistencia.alumno_id)\
     .join(Sesion, Sesion.id == AlertaInconsistencia.sesion_id)\
     .join(Taller, Taller.id == Sesion.taller_id)

    if colegio_id and colegio_id != "None":
        query = query.filter(AlertaInconsistencia.colegio_id == str(colegio_id))

    return query.order_by(AlertaInconsistencia.creado_at.desc()).all()


def create_nota_comportamiento(db: Session, data: NotaComportamientoCreate, colegio_id: str = None, usuario_id: str = None):
    from modules.sesiones.models import Sesion
    sesion = db.query(Sesion).filter(Sesion.id == str(data.sesion_id)).first()
    if not sesion:
        raise ValueError("Sesión no encontrada")

    active_colegio_id = str(colegio_id) if (colegio_id and colegio_id != "None") else sesion.colegio_id

    nueva_nota = NotaComportamiento(
        colegio_id=active_colegio_id,
        sesion_id=str(data.sesion_id),
        alumno_id=str(data.alumno_id),
        tipo=TipoComportamientoEnum[data.tipo.lower()],
        nota=(data.nota or "").strip(),
        creado_por=str(usuario_id) if usuario_id else None,
        creado_at=datetime.now().isoformat(),
    )
    db.add(nueva_nota)
    db.commit()
    db.refresh(nueva_nota)
    return nueva_nota


def get_notas_comportamiento(db: Session, colegio_id: str, sesion_id: UUID):
    query = db.query(NotaComportamiento).filter(NotaComportamiento.sesion_id == str(sesion_id))
    if colegio_id and colegio_id != "None":
        query = query.filter(NotaComportamiento.colegio_id == str(colegio_id))
    return query.order_by(NotaComportamiento.creado_at.desc()).all()


def delete_nota_comportamiento(db: Session, nota_id: UUID, colegio_id: str = None):
    query = db.query(NotaComportamiento).filter(NotaComportamiento.id == str(nota_id))
    if colegio_id and colegio_id != "None":
        query = query.filter(NotaComportamiento.colegio_id == str(colegio_id))
    nota = query.first()
    if nota:
        db.delete(nota)
        db.commit()
    return nota
