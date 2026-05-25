from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from modules.correos.models import CorreoReporte
from modules.correos.schemas import CorreoReporteCreate, CorreoReporteUpdate


def get_correos_by_colegio(db: Session, colegio_id: Optional[str]) -> List[CorreoReporte]:
    if not colegio_id:
        return db.query(CorreoReporte).all()
    return db.query(CorreoReporte).filter(CorreoReporte.colegio_id == str(colegio_id)).all()


def get_correos_habilitados_by_colegio(db: Session, colegio_id: str) -> List[CorreoReporte]:
    return db.query(CorreoReporte).filter(
        CorreoReporte.colegio_id == str(colegio_id),
        CorreoReporte.estado == True
    ).all()


def create_correo(db: Session, correo: CorreoReporteCreate, colegio_id: str) -> CorreoReporte:
    db_correo = CorreoReporte(
        email=correo.email,
        estado=correo.estado,
        colegio_id=str(colegio_id)
    )
    db.add(db_correo)
    db.commit()
    db.refresh(db_correo)
    return db_correo


def update_correo_estado(db: Session, correo_id: UUID, estado: bool, colegio_id: Optional[str] = None) -> Optional[CorreoReporte]:
    query = db.query(CorreoReporte).filter(CorreoReporte.id == str(correo_id))
    if colegio_id:
        query = query.filter(CorreoReporte.colegio_id == str(colegio_id))
        
    db_correo = query.first()
    if db_correo:
        db_correo.estado = estado
        db.commit()
        db.refresh(db_correo)
    return db_correo


def delete_correo(db: Session, correo_id: UUID, colegio_id: Optional[str] = None) -> bool:
    query = db.query(CorreoReporte).filter(CorreoReporte.id == str(correo_id))
    if colegio_id:
        query = query.filter(CorreoReporte.colegio_id == str(colegio_id))
        
    db_correo = query.first()
    if db_correo:
        db.delete(db_correo)
        db.commit()
        return True
    return False
