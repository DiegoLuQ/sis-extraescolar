import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from core.smtp_utils import obtener_credenciales_smtp

logger = logging.getLogger(__name__)


def enviar_correo_prueba(nombre_colegio: str, destinatario: str) -> dict:
    """Envía un correo de prueba a un destinatario para validar que la dirección
    y las credenciales SMTP del colegio funcionan correctamente."""
    sender_email, sender_password = obtener_credenciales_smtp(nombre_colegio)
    if not sender_email or not sender_password:
        return {"status": "missing_smtp_credentials", "sent": False}

    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1e293b; color: white; padding: 16px; text-align: center;">
                <h2 style="margin: 0;">Correo de Prueba</h2>
                <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">{nombre_colegio}</p>
            </div>
            <div style="padding: 20px;">
                <p>Este es un correo de prueba enviado desde el Sistema de Asistencia Extraescolar
                para confirmar que <strong>{destinatario}</strong> está correctamente configurado
                para recibir reportes automáticos.</p>
                <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
                    Si recibiste este mensaje, la configuración es correcta.
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart()
        msg["From"] = f"Sistema Extraescolar <{sender_email}>"
        msg["To"] = destinatario
        msg["Subject"] = "Correo de Prueba - Sistema de Asistencia Extraescolar"
        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()

        return {"status": "sent_success", "sent": True}
    except Exception as e:
        logger.exception(f"Error enviando correo de prueba a {destinatario}")
        return {"status": f"error: {str(e)}", "sent": False}
