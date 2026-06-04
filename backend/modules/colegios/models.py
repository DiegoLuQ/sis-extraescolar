import uuid
from sqlalchemy import Column, String, Boolean, Integer
from core.database import Base


class Colegio(Base):
    __tablename__ = "colegios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre_colegio = Column(String(255), nullable=False)
    rut_sostenedor = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    # Meta de asistencia global del colegio (%). Sirve de default para todos los talleres.
    meta_asistencia = Column(Integer, nullable=True, default=85)
    tema_color = Column(String(50), nullable=True, default="calipso")
    logo_url = Column(String(500), nullable=True)
