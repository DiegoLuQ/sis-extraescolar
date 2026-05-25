import uuid
from sqlalchemy import Column, String, Boolean
from core.database import Base


class Colegio(Base):
    __tablename__ = "colegios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre_colegio = Column(String(255), nullable=False)
    rut_sostenedor = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
