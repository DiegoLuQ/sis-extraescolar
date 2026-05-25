from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from modules.roles.models import Rol, Permiso


MODULOS = [
    "usuarios",
    "alumnos",
    "talleres",
    "inscripciones",
    "sesiones",
    "asistencias",
    "colegios",
    "roles"
]


def get_roles(db: Session, skip: int = 0, limit: int = 100) -> List[Rol]:
    return db.query(Rol).offset(skip).limit(limit).all()


def get_rol_by_id(db: Session, rol_id: UUID) -> Optional[Rol]:
    return db.query(Rol).filter(Rol.id == rol_id).first()


def get_rol_by_nombre(db: Session, nombre: str) -> Optional[Rol]:
    return db.query(Rol).filter(Rol.nombre == nombre).first()


def create_rol(db: Session, rol_data: dict) -> Rol:
    rol = Rol(**rol_data)
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


def update_rol(db: Session, rol_id: UUID, rol_data: dict) -> Optional[Rol]:
    rol = get_rol_by_id(db, rol_id)
    if not rol:
        return None
    for key, value in rol_data.items():
        if value is not None:
            setattr(rol, key, value)
    db.commit()
    db.refresh(rol)
    return rol


def delete_rol(db: Session, rol_id: UUID) -> bool:
    rol = get_rol_by_id(db, rol_id)
    if not rol:
        return False
    db.delete(rol)
    db.commit()
    return True


def get_permisos_by_rol(db: Session, rol_id: UUID) -> List[Permiso]:
    return db.query(Permiso).filter(Permiso.rol_id == rol_id).all()


def update_permisos_rol(db: Session, rol_id: UUID, permisos_data: List[dict]) -> List[Permiso]:
    # Eliminar permisos existentes
    db.query(Permiso).filter(Permiso.rol_id == rol_id).delete()
    
    # Crear nuevos permisos
    nuevos_permisos = []
    for permiso_data in permisos_data:
        permiso = Permiso(rol_id=rol_id, **permiso_data)
        db.add(permiso)
        nuevos_permisos.append(permiso)
    
    db.commit()
    
    # Refrescar y retornar
    nuevos_permisos = db.query(Permiso).filter(Permiso.rol_id == rol_id).all()
    return nuevos_permisos


def create_default_permisos(db: Session, rol_id: UUID) -> List[Permiso]:
    """Crea permisos por defecto para un rol (solo lectura)"""
    permisos = []
    for modulo in MODULOS:
        # Por defecto, solo leer
        permiso = Permiso(
            rol_id=rol_id,
            modulo=modulo,
            puede_leer=True,
            puede_crear=False,
            puede_editar=False,
            puede_eliminar=False
        )
        db.add(permiso)
        permisos.append(permiso)
    
    db.commit()
    return permisos
