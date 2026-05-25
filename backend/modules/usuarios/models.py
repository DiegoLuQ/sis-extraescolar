import uuid
import enum
from sqlalchemy import Column, String, Boolean, ForeignKey, Enum, Index
from core.database import Base


class RolEnum(str, enum.Enum):
    admin = "admin"
    monitor = "monitor"
    coordinador = "coordinador"


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        Index('ix_usuarios_nombre_colegio', 'nombre', 'colegio_id', unique=True),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    colegio_id = Column(String(36), ForeignKey("colegios.id"), nullable=True, index=True)
    nombre = Column(String(255), unique=True, nullable=False)
    nombre_2 = Column(String(255), nullable=True) # Nombre completo / Display Name
    email = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    rol = Column(Enum(RolEnum), nullable=False)
    is_active = Column(Boolean, default=True)
