from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, Optional
from modules.talleres.models import Taller
from modules.inscripciones.models import Inscripcion, EstadoInscripcionEnum
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia, EstadoAsistenciaEnum
from modules.alumnos.models import Alumno
from modules.usuarios.models import Usuario
from modules.estadisticas.schemas import (
    TallerOcupacion,
    AusentismoTaller,
    AlertaInasistencia,
    TallerAusentismoDetalle,
    AlumnoAsistenciaDetalle,
    TallerAsistenciaResumen,
    SesionAsistenciaItem,
)


def get_resumen_dashboard(db: Session, escuela_id: UUID = None, usuario_id: str = None, rol: str = None):
    q_usr = db.query(func.count(Usuario.id)).filter(Usuario.is_active == True)
    q_alu = db.query(func.count(Alumno.id)).filter(Alumno.is_active == True)
    q_tal = db.query(func.count(Taller.id)).filter(Taller.is_active == True)

    if escuela_id:
        q_usr = q_usr.filter(Usuario.colegio_id == str(escuela_id))
        q_alu = q_alu.filter(Alumno.colegio_id == str(escuela_id))
        q_tal = q_tal.filter(Taller.colegio_id == str(escuela_id))

    if rol == "monitor" and usuario_id:
        q_tal = q_tal.filter(Taller.profesor_id == str(usuario_id))

    return {
        "usuarios_count": q_usr.scalar() or 0,
        "alumnos_count": q_alu.scalar() or 0,
        "talleres_count": q_tal.scalar() or 0,
    }


def get_ocupacion_talleres(db: Session, escuela_id: UUID = None, usuario_id: str = None, rol: str = None):
    query = db.query(Taller).filter(Taller.is_active == True)
    if escuela_id:
        query = query.filter(Taller.colegio_id == str(escuela_id))
    if rol == "monitor" and usuario_id:
        query = query.filter(Taller.profesor_id == str(usuario_id))
    talleres = query.all()
    if not talleres:
        return []

    # Obtener número de inscritos activos agrupados por taller_id en 1 sola consulta
    taller_ids = [t.id for t in talleres]
    counts_query = (
        db.query(Inscripcion.taller_id, func.count(Inscripcion.id))
        .filter(
            Inscripcion.taller_id.in_(taller_ids),
            Inscripcion.estado == EstadoInscripcionEnum.inscrito
        )
        .group_by(Inscripcion.taller_id)
        .all()
    )
    inscripciones_map = dict(counts_query)

    resultado = []
    for taller in talleres:
        inscripciones_count = inscripciones_map.get(taller.id, 0)
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
    if not talleres:
        return []

    taller_ids = [t.id for t in talleres]

    # 1. Total de sesiones por taller (1 consulta)
    sesiones_counts = dict(
        db.query(Sesion.taller_id, func.count(Sesion.id))
        .filter(Sesion.taller_id.in_(taller_ids))
        .group_by(Sesion.taller_id)
        .all()
    )

    # 2. Total de inscritos activos por taller (1 consulta)
    inscritos_counts = dict(
        db.query(Inscripcion.taller_id, func.count(Inscripcion.id))
        .filter(
            Inscripcion.taller_id.in_(taller_ids),
            Inscripcion.estado == EstadoInscripcionEnum.inscrito
        )
        .group_by(Inscripcion.taller_id)
        .all()
    )

    # 3. Conteo acumulado de asistencias por taller y por estado (1 consulta)
    asistencias_query = (
        db.query(
            Sesion.taller_id,
            Asistencia.estado_asistencia,
            func.count(Asistencia.id)
        )
        .join(Asistencia, Asistencia.sesion_id == Sesion.id)
        .filter(Sesion.taller_id.in_(taller_ids))
        .group_by(Sesion.taller_id, Asistencia.estado_asistencia)
        .all()
    )

    asistencias_map = {}
    ausencias_map = {}

    for t_id, estado, count in asistencias_query:
        estado_str = estado.value if hasattr(estado, 'value') else str(estado)
        if estado_str == "presente":
            asistencias_map[t_id] = count
        elif estado_str == "ausente":
            ausencias_map[t_id] = count

    resultado = []
    for taller in talleres:
        total_sesiones = sesiones_counts.get(taller.id, 0)
        if total_sesiones == 0:
            continue

        num_inscritos = inscritos_counts.get(taller.id, 0)
        total_posibles = total_sesiones * num_inscritos

        total_asistencias = asistencias_map.get(taller.id, 0)
        total_ausencias = ausencias_map.get(taller.id, 0)

        if total_posibles > 0:
            porcentaje_ausentismo = (total_ausencias / total_posibles) * 100
        else:
            porcentaje_ausentismo = 0.0

        resultado.append(AusentismoTaller(
            taller_id=taller.id,
            nombre_taller=taller.nombre_taller,
            total_sesiones=total_sesiones,
            total_asistencias=total_asistencias,
            total_ausencias=total_ausencias,
            porcentaje_ausentismo=round(porcentaje_ausentismo, 2)
        ))
    return resultado


def get_alertas_inasistencias(
    db: Session,
    escuela_id: UUID = None,
    usuario_id: str = None,
    rol: str = None,
    min_ausencias: int = 3,
    taller_id: Optional[str] = None
):
    UMBRAL_AUSENCIA = 70.0

    # 1. Contar total de sesiones creadas por taller
    total_sesiones_query = db.query(Sesion.taller_id, func.count(Sesion.id)).group_by(Sesion.taller_id)
    if escuela_id:
        total_sesiones_query = total_sesiones_query.filter(Sesion.colegio_id == str(escuela_id))
    total_sesiones_map = dict(total_sesiones_query.all())

    if not total_sesiones_map:
        return []

    # 2. Agrupar ausencias por (alumno_id, taller_id)
    ausencias_query = (
        db.query(
            Asistencia.alumno_id,
            Sesion.taller_id,
            func.count(Asistencia.id).label("total_ausencias")
        )
        .join(Sesion, Asistencia.sesion_id == Sesion.id)
        .filter(Asistencia.estado_asistencia == EstadoAsistenciaEnum.ausente)
    )
    if escuela_id:
        ausencias_query = ausencias_query.filter(Asistencia.colegio_id == str(escuela_id))
    if taller_id:
        ausencias_query = ausencias_query.filter(Sesion.taller_id == str(taller_id))

    ausencias_grouped = ausencias_query.group_by(Asistencia.alumno_id, Sesion.taller_id).all()

    # 3. Filtrar aquellos donde ausencias > min_ausencias
    # Mapa (alumno_id, taller_id) -> ausencias
    ausencias_map = {}
    alumno_ids_filtrados = set()

    for alu_id, tal_id, num_ausencias in ausencias_grouped:
        if num_ausencias >= min_ausencias:
            ausencias_map[(str(alu_id), str(tal_id))] = num_ausencias
            alumno_ids_filtrados.add(str(alu_id))

    if not alumno_ids_filtrados:
        return []

    # 4. Obtener inscripciones activas para los alumnos y talleres filtrados
    inscripciones_query = (
        db.query(Inscripcion, Alumno, Taller)
        .join(Alumno, Inscripcion.alumno_id == Alumno.id)
        .join(Taller, Inscripcion.taller_id == Taller.id)
        .filter(
            Inscripcion.estado == EstadoInscripcionEnum.inscrito,
            Taller.is_active == True,
            Inscripcion.alumno_id.in_(list(alumno_ids_filtrados))
        )
    )
    if escuela_id:
        inscripciones_query = inscripciones_query.filter(Inscripcion.colegio_id == str(escuela_id))
    if taller_id:
        inscripciones_query = inscripciones_query.filter(Inscripcion.taller_id == str(taller_id))

    inscripciones_rows = inscripciones_query.all()

    alumno_map: Dict[str, dict] = {}

    for ins, alumno, taller in inscripciones_rows:
        key = (str(ins.alumno_id), str(ins.taller_id))
        if key not in ausencias_map:
            continue

        ausencias = ausencias_map[key]
        total_sesiones = total_sesiones_map.get(str(ins.taller_id), 0)
        if total_sesiones == 0:
            continue

        porcentaje = round((ausencias / total_sesiones) * 100, 1)

        alumno_id_str = str(alumno.id)
        if alumno_id_str not in alumno_map:
            alumno_map[alumno_id_str] = {"alumno": alumno, "talleres": []}

        alumno_map[alumno_id_str]["talleres"].append(
            TallerAusentismoDetalle(
                nombre_taller=taller.nombre_taller,
                total_sesiones=total_sesiones,
                ausencias=ausencias,
                porcentaje_ausencia=porcentaje,
                taller_id=taller.id,
                inscripcion_id=ins.id,
            )
        )

    resultado = [
        AlertaInasistencia(
            alumno_id=data["alumno"].id,
            nombre_completo=data["alumno"].nombre_completo,
            curso=data["alumno"].curso,
            telefono=data["alumno"].telefono,
            talleres=data["talleres"],
        )
        for data in alumno_map.values()
        if data["talleres"]
    ]
    resultado.sort(key=lambda a: max(t.ausencias for t in a.talleres), reverse=True)
    return resultado



def get_detalle_asistencia_alumno(db: Session, alumno_id: UUID, escuela_id: UUID = None):
    """
    Retorna el resumen de asistencia/inasistencia de un alumno en todos sus talleres
    inscritos, desglosado por sesión (fecha y estado). Incluye los datos de contacto
    del alumno (nombre, curso, rut, telefono).
    """
    alumno_query = db.query(Alumno).filter(Alumno.id == str(alumno_id))
    if escuela_id:
        alumno_query = alumno_query.filter(Alumno.colegio_id == str(escuela_id))
    alumno = alumno_query.first()
    if not alumno:
        return None

    inscripciones = (
        db.query(Inscripcion)
        .join(Taller, Taller.id == Inscripcion.taller_id)
        .filter(
            Inscripcion.alumno_id == str(alumno_id),
            Inscripcion.estado == EstadoInscripcionEnum.inscrito,
            Taller.is_active == True,
        )
        .all()
    )

    talleres_resumen = []
    for inscripcion in inscripciones:
        taller = db.query(Taller).filter(Taller.id == inscripcion.taller_id).first()
        if not taller:
            continue

        sesiones = (
            db.query(Sesion)
            .filter(Sesion.taller_id == taller.id)
            .order_by(Sesion.fecha_sesion)
            .all()
        )

        items = []
        counts = {"presente": 0, "ausente": 0, "justificado": 0, "atraso": 0, "sin_registro": 0}
        for sesion in sesiones:
            asistencia = db.query(Asistencia).filter(
                Asistencia.sesion_id == sesion.id,
                Asistencia.alumno_id == str(alumno_id),
            ).first()
            estado = asistencia.estado_asistencia.value if asistencia else "sin_registro"
            counts[estado] = counts.get(estado, 0) + 1
            items.append(SesionAsistenciaItem(
                fecha=sesion.fecha_sesion,
                tematica=sesion.tematica,
                estado=estado,
            ))

        talleres_resumen.append(TallerAsistenciaResumen(
            taller_id=taller.id,
            nombre_taller=taller.nombre_taller,
            total_sesiones=len(sesiones),
            presentes=counts["presente"],
            ausentes=counts["ausente"],
            justificados=counts["justificado"],
            atrasos=counts["atraso"],
            sin_registro=counts["sin_registro"],
            sesiones=items,
        ))

    return AlumnoAsistenciaDetalle(
        alumno_id=alumno.id,
        nombre_completo=alumno.nombre_completo,
        rut=alumno.rut,
        curso=alumno.curso,
        telefono=alumno.telefono,
        talleres=talleres_resumen,
    )
