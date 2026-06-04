from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional
from datetime import date


class TallerOcupacion(BaseModel):
    taller_id: UUID
    nombre_taller: str
    cupos_maximos: int
    inscripciones_activas: int
    porcentaje_ocupacion: float


class AusentismoTaller(BaseModel):
    taller_id: UUID
    nombre_taller: str
    total_sesiones: int
    total_asistencias: int
    total_ausencias: int
    porcentaje_ausentismo: float


class TallerAusentismoDetalle(BaseModel):
    nombre_taller: str
    total_sesiones: int
    ausencias: int
    porcentaje_ausencia: float
    taller_id: UUID
    inscripcion_id: UUID


class AlertaInasistencia(BaseModel):
    alumno_id: UUID
    nombre_completo: str
    curso: str
    telefono: str | None = None
    talleres: List[TallerAusentismoDetalle]


class SesionAsistenciaItem(BaseModel):
    fecha: date
    tematica: Optional[str] = None
    estado: str  # presente | ausente | justificado | atraso | sin_registro


class TallerAsistenciaResumen(BaseModel):
    taller_id: UUID
    nombre_taller: str
    total_sesiones: int
    presentes: int
    ausentes: int
    justificados: int
    atrasos: int
    sin_registro: int
    sesiones: List[SesionAsistenciaItem]


class AlumnoAsistenciaDetalle(BaseModel):
    alumno_id: UUID
    nombre_completo: str
    rut: str
    curso: str
    telefono: Optional[str] = None
    talleres: List[TallerAsistenciaResumen]
