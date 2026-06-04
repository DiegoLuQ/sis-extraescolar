from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from uuid import UUID

class WorkshopAttendance(BaseModel):
    id: UUID
    nombre_taller: str
    matriculados: int
    asistencias: Dict[str, Optional[int]]  # { "2026-05-01": 15, ... }
    total_taller: int

class MonthlyReportResponse(BaseModel):
    active_days: List[str]  # Fechas ordenadas
    workshops: List[WorkshopAttendance]
    daily_stats: Dict[str, Dict[str, float]] # { "2026-05-01": { "presentes": 100, "matricula_total": 500, "porcentaje": 20.0 } }
    total_enrollment: int

class WeeklyReportResponse(BaseModel):
    weeks: List[Dict[str, Any]]
    total_enrollment: int
    active_days_count: int

class AnnualReportResponse(BaseModel):
    months: List[Dict[str, Any]]
    total_enrollment: int
    total_presentes_anio: int
    promedio_anual: float

class WeeklyComparisonDay(BaseModel):
    fecha: str
    dia: str
    presentes: int
    matricula_total: int
    porcentaje_asistencia: float
    diferencia_anterior: Optional[float] = None

class WeeklySummaryResponse(BaseModel):
    total_hoy: int
    semana_actual: List[WeeklyComparisonDay]
    semana_anterior: List[WeeklyComparisonDay]
    total_semana_actual: int
    total_semana_anterior: int
    comparativa_totales_porcentaje: Optional[float] = None


class TallerMetaItem(BaseModel):
    taller_id: UUID
    nombre_taller: str
    asistencias: int           # nº de asistencias efectivas (presente+atraso+justificado)
    registros: int             # total de registros (denominador: lista pasada)
    porcentaje: float          # asistencias / registros * 100
    meta: int                  # meta efectiva (taller o, en su defecto, colegio)
    cumple: bool               # porcentaje >= meta


class MetasTotal(BaseModel):
    asistencias: int
    registros: int
    porcentaje: float
    meta: int                  # meta global del colegio
    cumple: bool


class MetasSemana(BaseModel):
    semana_inicio: str  # YYYY-MM-DD
    semana_fin: str     # YYYY-MM-DD
    items: List[TallerMetaItem]
    total: MetasTotal


class MetasReportResponse(BaseModel):
    mensual: List[TallerMetaItem]
    total_mensual: MetasTotal
    semanas: List[MetasSemana]

