from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from core.database import get_db
from modules.colegios.schemas import ColegioCreate, ColegioUpdate, ColegioResponse
from modules.colegios import crud

router = APIRouter(prefix="/api/colegios", tags=["colegios"])


@router.get("", response_model=List[ColegioResponse])
def list_colegios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_colegios(db, skip=skip, limit=limit)


@router.get("/{colegio_id}", response_model=ColegioResponse)
def get_colegio(colegio_id: UUID, db: Session = Depends(get_db)):
    db_colegio = crud.get_colegio_by_id(db, colegio_id)
    if not db_colegio:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    return db_colegio


@router.post("", response_model=ColegioResponse, status_code=status.HTTP_201_CREATED)
def create_colegio(colegio: ColegioCreate, db: Session = Depends(get_db)):
    return crud.create_colegio(db, colegio)


@router.patch("/{colegio_id}", response_model=ColegioResponse)
def update_colegio(colegio_id: UUID, colegio: ColegioUpdate, db: Session = Depends(get_db)):
    db_colegio = crud.update_colegio(db, colegio_id, colegio)
    if not db_colegio:
        raise HTTPException(status_code=404, detail="Colegio no encontrado")
    return db_colegio


@router.delete("/{colegio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_colegio(colegio_id: UUID, db: Session = Depends(get_db)):
    crud.delete_colegio(db, colegio_id)
