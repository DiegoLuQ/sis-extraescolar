import os
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from zoneinfo import ZoneInfo

from core.database import get_db
from modules.alumnos.models import Alumno
from modules.colegios.models import Colegio
from modules.inscripciones.models import Inscripcion
from modules.talleres.models import Taller, TallerHorario
from modules.usuarios.models import Usuario
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia, NotaComportamiento

router = APIRouter(prefix="/api/buscar-alumnos", tags=["buscador"])

DEFAULT_PIN = os.getenv("BUSCADOR_PIN", "12345")
TIMEZONE = ZoneInfo("America/Santiago")

DIAS_MAP = {
    0: "Lunes",
    1: "Martes",
    2: "Miércoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sábado",
    6: "Domingo"
}


class ValidarPinRequest(BaseModel):
    pin: str


class BuscarAlumnosRequest(BaseModel):
    pin: str
    query: str


@router.post("/validar-pin")
def validar_pin(req: ValidarPinRequest):
    pin_correcto = os.getenv("BUSCADOR_PIN", DEFAULT_PIN)
    if req.pin.strip() == pin_correcto.strip():
        return {"valid": True, "message": "PIN correcto"}
    return {"valid": False, "message": "PIN incorrecto"}


@router.post("/buscar")
def buscar_alumnos(req: BuscarAlumnosRequest, db: Session = Depends(get_db)):
    pin_correcto = os.getenv("BUSCADOR_PIN", DEFAULT_PIN)
    if req.pin.strip() != pin_correcto.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN de acceso inválido"
        )

    search_query = req.query.strip()
    if not search_query:
        return {"results": []}

    # Intentar compilar expresión regular
    try:
        pattern = re.compile(search_query, re.IGNORECASE)
        is_regex_valid = True
    except Exception:
        pattern = None
        is_regex_valid = False

    def normalize_str(val: str) -> str:
        if not val:
            return ""
        return val.replace(".", "").replace("-", "").lower()

    norm_query = normalize_str(search_query)

    # Buscar alumnos
    todos_alumnos = db.query(Alumno).filter(Alumno.is_active == True).all()
    colegios_dict = {c.id: c.nombre_colegio for c in db.query(Colegio).all()}

    alumnos_coincidentes = []

    for alu in todos_alumnos:
        coincide = False
        rut_clean = normalize_str(alu.rut)
        nombre_clean = alu.nombre_completo or ""

        if is_regex_valid and pattern:
            if pattern.search(alu.rut) or pattern.search(nombre_clean):
                coincide = True
        
        if not coincide:
            if norm_query in rut_clean or search_query.lower() in nombre_clean.lower():
                coincide = True

        if coincide:
            alumnos_coincidentes.append(alu)

    # Limitar a máximo 30 resultados para mantener fluidez
    alumnos_coincidentes = alumnos_coincidentes[:30]

    # Determinar día actual
    hoy = datetime.now(TIMEZONE)
    dia_actual_nombre = DIAS_MAP[hoy.weekday()]

    resultados = []

    for alu in alumnos_coincidentes:
        nombre_colegio = colegios_dict.get(alu.colegio_id, "Establecimiento")

        # Obtener inscripciones activas
        inscripciones = (
            db.query(Inscripcion, Taller)
            .join(Taller, Inscripcion.taller_id == Taller.id)
            .filter(
                Inscripcion.alumno_id == alu.id,
                Inscripcion.estado == "inscrito",
                Taller.is_active == True
            )
            .all()
        )

        talleres_info = []

        for ins, taller in inscripciones:
            # Obtener monitor
            monitor = db.query(Usuario).filter(Usuario.id == taller.profesor_id).first()
            monitor_nombre = monitor.nombre_completo if monitor else "Sin monitor"
            monitor_email = monitor.email if monitor else ""

            # Horarios
            horarios = (
                db.query(TallerHorario)
                .filter(TallerHorario.taller_id == taller.id)
                .all()
            )
            horarios_list = [
                {
                    "dia": h.dia,
                    "hora_inicio": h.hora_inicio,
                    "hora_fin": h.hora_fin
                }
                for h in horarios
            ]

            # Verificar si el taller corresponde al día de hoy
            dias_taller_str = (taller.dia or "").lower()
            es_hoy_por_str = dia_actual_nombre.lower() in dias_taller_str
            es_hoy_por_horario = any(h.dia.lower() == dia_actual_nombre.lower() for h in horarios)
            es_hoy = es_hoy_por_str or es_hoy_por_horario

            # Obtener sesiones del taller
            sesiones = (
                db.query(Sesion)
                .filter(Sesion.taller_id == taller.id)
                .order_by(Sesion.fecha_sesion.desc())
                .all()
            )

            # Obtener asistencias del alumno en este taller
            sesiones_ids = [s.id for s in sesiones]
            asistencias_dict = {}
            if sesiones_ids:
                asistencias = (
                    db.query(Asistencia)
                    .filter(
                        Asistencia.alumno_id == alu.id,
                        Asistencia.sesion_id.in_(sesiones_ids)
                    )
                    .all()
                )
                for a in asistencias:
                    asistencias_dict[a.sesion_id] = {
                        "estado": a.estado_asistencia.value if hasattr(a.estado_asistencia, 'value') else str(a.estado_asistencia),
                        "observaciones": a.observaciones
                    }

            # Historial de sesiones
            historial_sesiones = []
            presentes = 0
            ausentes = 0
            atrasos = 0
            justificados = 0

            for s in sesiones:
                ast = asistencias_dict.get(s.id)
                estado = ast["estado"] if ast else "sin_registro"
                obs = ast["observaciones"] if ast else ""

                if estado == "presente":
                    presentes += 1
                elif estado == "ausente":
                    ausentes += 1
                elif estado == "atraso":
                    atrasos += 1
                elif estado == "justificado":
                    justificados += 1

                historial_sesiones.append({
                    "sesion_id": s.id,
                    "fecha": s.fecha_sesion.strftime('%d/%m/%Y'),
                    "tematica": s.tematica or "Sin temática",
                    "estado": estado,
                    "observaciones": obs,
                    "bloqueada": s.bloqueada
                })

            total_sesiones = len(sesiones)
            porcentaje = (
                round(((presentes + atrasos) / total_sesiones) * 100, 1)
                if total_sesiones > 0
                else 100.0
            )

            talleres_info.append({
                "taller_id": taller.id,
                "nombre_taller": taller.nombre_taller,
                "dias_resumen": taller.dia,
                "horarios": horarios_list,
                "monitor": {
                    "nombre": monitor_nombre,
                    "email": monitor_email
                },
                "es_hoy": es_hoy,
                "estadisticas": {
                    "total_sesiones": total_sesiones,
                    "presentes": presentes,
                    "ausentes": ausentes,
                    "atrasos": atrasos,
                    "justificados": justificados,
                    "porcentaje_asistencia": porcentaje
                },
                "sesiones": historial_sesiones
            })

        resultados.append({
            "alumno_id": alu.id,
            "rut": alu.rut,
            "nombre_completo": alu.nombre_completo,
            "curso": alu.curso,
            "telefono": alu.telefono,
            "colegio_id": alu.colegio_id,
            "nombre_colegio": nombre_colegio,
            "talleres": talleres_info
        })

    return {
        "query": search_query,
        "regex_valid": is_regex_valid,
        "dia_actual": dia_actual_nombre,
        "total_resultados": len(resultados),
        "results": resultados
    }
