from datetime import datetime
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from modules.reportes_programados.models import ReporteProgramado
from modules.reportes_programados.schemas import ReporteProgramadoCreate, ReporteProgramadoUpdate


def get_reportes(db: Session, colegio_id: Optional[str]) -> List[ReporteProgramado]:
    if not colegio_id:
        return db.query(ReporteProgramado).all()
    return db.query(ReporteProgramado).filter(ReporteProgramado.colegio_id == str(colegio_id)).all()


def get_reporte_by_id(db: Session, reporte_id: UUID, colegio_id: Optional[str] = None) -> Optional[ReporteProgramado]:
    query = db.query(ReporteProgramado).filter(ReporteProgramado.id == str(reporte_id))
    if colegio_id:
        query = query.filter(ReporteProgramado.colegio_id == str(colegio_id))
    return query.first()


def create_reporte(db: Session, reporte: ReporteProgramadoCreate, colegio_id: str, creado_por: Optional[str] = None) -> ReporteProgramado:
    db_reporte = ReporteProgramado(
        colegio_id=str(colegio_id),
        nombre=reporte.nombre,
        frecuencia=reporte.frecuencia,
        destinatarios=reporte.destinatarios,
        activo=reporte.activo if reporte.activo is not None else True,
        creado_por=creado_por,
        creado_at=datetime.utcnow().isoformat(),
    )
    db.add(db_reporte)
    db.commit()
    db.refresh(db_reporte)
    return db_reporte


def update_reporte(db: Session, reporte_id: UUID, data: ReporteProgramadoUpdate, colegio_id: Optional[str] = None) -> Optional[ReporteProgramado]:
    db_reporte = get_reporte_by_id(db, reporte_id, colegio_id)
    if not db_reporte:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_reporte, key, value)
    db.commit()
    db.refresh(db_reporte)
    return db_reporte


def delete_reporte(db: Session, reporte_id: UUID, colegio_id: Optional[str] = None) -> bool:
    db_reporte = get_reporte_by_id(db, reporte_id, colegio_id)
    if not db_reporte:
        return False
    db.delete(db_reporte)
    db.commit()
    return True


def marcar_ejecucion(db: Session, reporte_id: str, fecha_str: str, estado_str: str) -> None:
    db_reporte = db.query(ReporteProgramado).filter(ReporteProgramado.id == str(reporte_id)).first()
    if db_reporte:
        db_reporte.ultima_ejecucion = fecha_str
        db_reporte.ultimo_estado = estado_str
        db.commit()
