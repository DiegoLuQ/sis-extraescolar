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


def obtener_destinatarios_to_y_cc(destinatarios_emails: list[str], nombre_colegio: str = "") -> tuple[str, list[str]]:
    """
    Organiza la lista de correos habilitados en (to_email, cc_emails).
    - El 'Para' (To) principal corresponde al rol de coordinador:
        * Colegio Macaya: 'coordinadorextraescolar@colegiomacaya.cl'
        * Colegio Diego Portales: 'claudia.colina@colegiodiegoportales.cl'
    - Si el correo del coordinador no figura en la lista, se utiliza el primer correo de la lista.
    - Todos los demás correos habilitados van como copia ('Cc').
    """
    if not destinatarios_emails:
        return ("", [])

    nombre_lower = (nombre_colegio or "").lower()
    if "macaya" in nombre_lower:
        coord_principal = "coordinadorextraescolar@colegiomacaya.cl"
    else:
        coord_principal = "claudia.colina@colegiodiegoportales.cl"

    # Buscar si el correo del coordinador principal está en la lista (insensible a mayúsculas)
    to_email = None
    for email in destinatarios_emails:
        if email.strip().lower() == coord_principal.lower():
            to_email = email.strip()
            break

    # Si no se encuentra explícitamente en la lista, tomar el primer correo disponible
    if not to_email:
        to_email = destinatarios_emails[0].strip()

    # Todos los demás correos habilitados de la lista van a CC (evitando duplicar to_email)
    cc_emails = [
        email.strip() for email in destinatarios_emails
        if email.strip().lower() != to_email.lower()
    ]

    return (to_email, cc_emails)

