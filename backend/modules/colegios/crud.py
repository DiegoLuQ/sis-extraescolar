from sqlalchemy.orm import Session
from modules.colegios.models import Colegio
from modules.colegios.schemas import ColegioCreate, ColegioUpdate
from uuid import UUID


def get_colegios(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Colegio).filter(Colegio.is_active == True).offset(skip).limit(limit).all()


def get_colegio_by_id(db: Session, colegio_id: UUID):
    return db.query(Colegio).filter(Colegio.id == str(colegio_id)).first()


def create_colegio(db: Session, colegio: ColegioCreate):
    db_colegio = Colegio(**colegio.model_dump())
    db.add(db_colegio)
    db.commit()
    db.refresh(db_colegio)
    return db_colegio


def update_colegio(db: Session, colegio_id: UUID, colegio: ColegioUpdate):
    db_colegio = get_colegio_by_id(db, colegio_id)
    if db_colegio:
        for key, value in colegio.model_dump(exclude_unset=True).items():
            setattr(db_colegio, key, value)
        db.commit()
        db.refresh(db_colegio)
    return db_colegio


def delete_colegio(db: Session, colegio_id: UUID):
    db_colegio = get_colegio_by_id(db, colegio_id)
    if db_colegio:
        db_colegio.is_active = False
        db.commit()
        db.refresh(db_colegio)
    return db_colegio
