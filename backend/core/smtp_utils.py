import os
from typing import Optional
from core.config import settings


def obtener_credenciales_smtp(nombre_colegio: str) -> tuple[Optional[str], Optional[str]]:
    """Selecciona las credenciales SMTP institucionales según el colegio."""
    if "macaya" in (nombre_colegio or "").lower():
        sender_email = settings.MC_SENDER_EMAIL or os.getenv("MC_SENDER_EMAIL")
        sender_password = settings.MC_SENDER_PASSWORD or os.getenv("MC_SENDER_PASSWORD")
    else:
        sender_email = settings.DP_SENDER_EMAIL or os.getenv("DP_SENDER_EMAIL")
        sender_password = settings.DP_SENDER_PASSWORD or os.getenv("DP_SENDER_PASSWORD")
    return sender_email, sender_password
