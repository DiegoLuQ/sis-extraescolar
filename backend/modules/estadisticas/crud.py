from sqlalchemy.orm import Session
from uuid import UUID
from modules.talleres.models import Taller
from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia, EstadoAsistenciaEnum
from modules.alumnos.models import Alumno
from modules.estadisticas.schemas import TallerOcupacion, AusentismoTaller, AlertaInasistencia


def get_ocupacion_talleres(db: Session, escuela_id: UUID = None, usuario_id: str = None, rol: str = None):
    query = db.query(Taller).filter(Taller.is_active == True)
    if escuela_id:
        query = query.filter(Taller.colegio_id == str(escuela_id))
    if rol == "monitor" and usuario_id:
        query = query.filter(Taller.profesor_id == str(usuario_id))
    talleres = query.all()
    resultado = []
    for taller in talleres:
        inscripciones_count = db.query(Inscripcion).filter(
            Inscripcion.taller_id == taller.id,
            Inscripcion.estado == EstadoInscripcionEnum.inscrito
        ).count()
        porcentaje = (inscripciones_count / taller.cupos_maximos * 100) if taller.cupos_maximos > 0 else 0
        resultado.append(TallerOcupacion(
            taller_id=taller.id,
            nombre_taller=taller.nombre_taller,
            cupos_maximos=taller.cupos_maximos,
            inscripciones_activas=inscripciones_count,
            porcentaje_ocupacion=round(porcentaje, 2)
        ))
    return resultado


def get_ausentismo(db: Session, escuela_id: UUID = None, usuario_id: str = None, rol: str = None):
    query = db.query(Taller).filter(Taller.is_active == True)
    if escuela_id:
        query = query.filter(Taller.colegio_id == str(escuela_id))
    if rol == "monitor" and usuario_id:
        query = query.filter(Taller.profesor_id == str(usuario_id))
    talleres = query.all()
    resultado = []
    for taller in talleres:
        sesiones = db.query(Sesion).filter(Sesion.taller_id == taller.id).all()
        total_sesiones = len(sesiones)
        
        if total_sesiones == 0:
            continue
        
        inscripciones = db.query(Inscripcion).filter(
            Inscripcion.taller_id == taller.id,
            Inscripcion.estado == EstadoInscripcionEnum.inscrito
        ).all()
        
        total_asistencias = 0
        total_ausencias = 0
        
        for inscripcion in inscripciones:
            for sesion in sesiones:
                asistencia = db.query(Asistencia).filter(
                    Asistencia.sesion_id == sesion.id,
                    Asistencia.alumno_id == inscripcion.alumno_id
                ).first()
                
                if asistencia:
                    if asistencia.estado_asistencia == EstadoAsistenciaEnum.presente:
                        total_asistencias += 1
                    elif asistencia.estado_asistencia == EstadoAsistenciaEnum.ausente:
                        total_ausencias += 1
        
        total_posibles = total_sesiones * len(inscripciones)
        if total_posibles > 0:
            porcentaje_ausentismo = (total_ausencias / total_posibles) * 100
        else:
            porcentaje_ausentismo = 0
            
        resultado.append(AusentismoTaller(
            taller_id=taller.id,
            nombre_taller=taller.nombre_taller,
            total_sesiones=total_sesiones,
            total_asistencias=total_asistencias,
            total_ausencias=total_ausencias,
            porcentaje_ausentismo=round(porcentaje_ausentismo, 2)
        ))
    return resultado


def get_alertas_inasistencias(db: Session, escuela_id: UUID = None, umbral: int = 3, usuario_id: str = None, rol: str = None):
    query = db.query(Inscripcion).join(Taller).filter(
        Inscripcion.estado == EstadoInscripcionEnum.inscrito,
        Taller.is_active == True
    )
    if escuela_id:
        query = query.filter(Inscripcion.colegio_id == str(escuela_id))
    if rol == "monitor" and usuario_id:
        query = query.filter(Taller.profesor_id == str(usuario_id))
    inscripciones = query.all()
    
    resultado = []
    for inscripcion in inscripciones:
        sesiones = db.query(Sesion).filter(Sesion.taller_id == inscripcion.taller_id).order_by(Sesion.fecha_sesion.desc()).all()
        
        inasistencias_consecutivas = 0
        for sesion in sesiones:
            asistencia = db.query(Asistencia).filter(
                Asistencia.sesion_id == sesion.id,
                Asistencia.alumno_id == inscripcion.alumno_id
            ).first()
            
            if asistencia and asistencia.estado_asistencia == EstadoAsistenciaEnum.ausente:
                inasistencias_consecutivas += 1
            else:
                break
        
        if inasistencias_consecutivas >= umbral:
            alumno = db.query(Alumno).filter(Alumno.id == inscripcion.alumno_id).first()
            taller = db.query(Taller).filter(Taller.id == inscripcion.taller_id).first()
            if alumno and taller:
                resultado.append(AlertaInasistencia(
                    alumno_id=alumno.id,
                    rut=alumno.rut,
                    nombre_completo=alumno.nombre_completo,
                    taller=taller.nombre_taller,
                    inasistencias_consecutivas=inasistencias_consecutivas
                ))
    return resultado
