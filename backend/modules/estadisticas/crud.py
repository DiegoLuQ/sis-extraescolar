from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict
from modules.talleres.models import Taller
from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia, EstadoAsistenciaEnum
from modules.alumnos.models import Alumno
from modules.estadisticas.schemas import TallerOcupacion, AusentismoTaller, AlertaInasistencia, TallerAusentismoDetalle


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


def get_alertas_inasistencias(db: Session, escuela_id: UUID = None, usuario_id: str = None, rol: str = None):
    UMBRAL_AUSENCIA = 70.0

    query = db.query(Inscripcion).join(Taller).filter(
        Inscripcion.estado == EstadoInscripcionEnum.inscrito,
        Taller.is_active == True
    )
    if escuela_id:
        query = query.filter(Inscripcion.colegio_id == str(escuela_id))
    inscripciones = query.all()

    alumno_map: Dict[str, dict] = {}

    for inscripcion in inscripciones:
        sesion_ids = [s.id for s in db.query(Sesion.id).filter(Sesion.taller_id == inscripcion.taller_id).all()]
        total_sesiones = len(sesion_ids)
        if total_sesiones == 0:
            continue

        ausencias = db.query(Asistencia).filter(
            Asistencia.alumno_id == inscripcion.alumno_id,
            Asistencia.sesion_id.in_(sesion_ids),
            Asistencia.estado_asistencia == EstadoAsistenciaEnum.ausente
        ).count()

        porcentaje = round((ausencias / total_sesiones) * 100, 1)
        if porcentaje <= UMBRAL_AUSENCIA:
            continue

        alumno_id_str = str(inscripcion.alumno_id)
        if alumno_id_str not in alumno_map:
            alumno = db.query(Alumno).filter(Alumno.id == alumno_id_str).first()
            if not alumno:
                continue
            alumno_map[alumno_id_str] = {"alumno": alumno, "talleres": []}

        taller = db.query(Taller).filter(Taller.id == inscripcion.taller_id).first()
        if taller:
            alumno_map[alumno_id_str]["talleres"].append(
                TallerAusentismoDetalle(
                    nombre_taller=taller.nombre_taller,
                    total_sesiones=total_sesiones,
                    ausencias=ausencias,
                    porcentaje_ausencia=porcentaje,
                    taller_id=taller.id,
                    inscripcion_id=inscripcion.id,
                )
            )

    resultado = [
        AlertaInasistencia(
            alumno_id=data["alumno"].id,
            nombre_completo=data["alumno"].nombre_completo,
            curso=data["alumno"].curso,
            talleres=data["talleres"],
        )
        for data in alumno_map.values()
    ]
    resultado.sort(key=lambda a: max(t.porcentaje_ausencia for t in a.talleres), reverse=True)
    return resultado
