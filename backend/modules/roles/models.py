import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from core.database import Base


class Rol(Base):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    permisos = relationship("Permiso", back_populates="rol", cascade="all, delete-orphan")


class Permiso(Base):
    __tablename__ = "permisos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rol_id = Column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    modulo = Column(String(50), nullable=False)
    puede_crear = Column(Boolean, default=False)
    puede_leer = Column(Boolean, default=False)
    puede_editar = Column(Boolean, default=False)
    puede_eliminar = Column(Boolean, default=False)

    rol = relationship("Rol", back_populates="permisos")

    __table_args__ = (
        Index('ix_permisos_rol_modulo', 'rol_id', 'modulo', unique=True),
    )
