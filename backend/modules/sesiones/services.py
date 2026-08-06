from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Dict
from modules.sesiones import crud
from modules.inscripciones.crud import get_inscripciones
from modules.alumnos.models import Alumno
from modules.inscripciones.models import Inscripcion
from core.external_db import get_absent_ruts_from_external
from core.config import settings

def get_absent_students_from_school(db: Session, sesion_id: UUID, colegio_id: str) -> List[Dict]:
    """
    Busca qué alumnos inscritos en el taller de la sesión están marcados como 'Ausente' 
    en las bases de datos externas del colegio.
    """
    # 1. Obtener la sesión
    sesion = crud.get_sesion_by_id(db, sesion_id, colegio_id)
    if not sesion:
        return []
        
    # 2. Obtener inscritos en el taller (incluyendo datos de alumno)
    inscripciones = db.query(Inscripcion, Alumno).join(
        Alumno, Inscripcion.alumno_id == Alumno.id
    ).filter(
        Inscripcion.taller_id == sesion.taller_id,
        Inscripcion.estado == "inscrito"
    ).all()
    
    if not inscripciones:
        return []
        
    # 3. Consultar bases de datos externas (MC y DP)
    fecha_str = sesion.fecha_sesion.isoformat()
    absents_mc = get_absent_ruts_from_external('MC', fecha_str)
    absents_dp = get_absent_ruts_from_external('DP', fecha_str)
    
    # Unir y normalizar RUTs (quitar puntos y guiones, pasar a mayúsculas)
    def normalize_rut(rut: str) -> str:
        return rut.replace('.', '').replace('-', '').upper()
        
    norm_absents = {normalize_rut(r) for r in (absents_mc + absents_dp)}
    
    # 4. Cruzar datos
    absent_students = []
    for ins, alu in inscripciones:
        if normalize_rut(alu.rut) in norm_absents:
            absent_students.append({
                "alumno_id": alu.id,
                "rut": alu.rut,
                "nombre_completo": alu.nombre_completo,
                "curso": alu.curso
            })
            
    return absent_students


def enviar_reporte_inconsistencias_smtp(db: Session, sesion_id: UUID, colegio_id: str):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import os
    from modules.asistencias.models import AlertaInconsistencia
    from modules.alumnos.models import Alumno
    from modules.correos.crud import get_correos_habilitados_by_colegio
    from modules.colegios.models import Colegio
    from modules.talleres.models import Taller
    from modules.sesiones.models import Sesion
    
    destinatarios = get_correos_habilitados_by_colegio(db, colegio_id)
    if not destinatarios:
        return {"status": "no_recipients", "sent": False}
        
    sesion = db.query(Sesion).filter(Sesion.id == str(sesion_id)).first()
    if not sesion:
        return {"status": "sesion_not_found", "sent": False}
        
    taller = db.query(Taller).filter(Taller.id == sesion.taller_id).first()
    nombre_taller = taller.nombre_taller if taller else "Taller Desconocido"
    
    alertas = db.query(AlertaInconsistencia, Alumno).join(
        Alumno, AlertaInconsistencia.alumno_id == Alumno.id
    ).filter(
        AlertaInconsistencia.sesion_id == str(sesion_id),
        AlertaInconsistencia.fecha == sesion.fecha_sesion.isoformat()
    ).all()
    
    if not alertas:
        return {"status": "no_alerts", "sent": False}
        
    colegio = db.query(Colegio).filter(Colegio.id == str(colegio_id)).first()
    nombre_colegio = colegio.nombre_colegio if colegio else ""
    
    if "macaya" in nombre_colegio.lower():
        sender_email = settings.MC_SENDER_EMAIL or os.getenv("MC_SENDER_EMAIL")
        sender_password = settings.MC_SENDER_PASSWORD or os.getenv("MC_SENDER_PASSWORD")
    else:
        sender_email = settings.DP_SENDER_EMAIL or os.getenv("DP_SENDER_EMAIL")
        sender_password = settings.DP_SENDER_PASSWORD or os.getenv("DP_SENDER_PASSWORD")
        
    if not sender_email or not sender_password:
        print("Faltan credenciales SMTP en variables de entorno")
        return {"status": "missing_smtp_credentials", "sent": False}
        
    from core.smtp_utils import obtener_destinatarios_to_y_cc

    destinatarios_emails = [d.email for d in destinatarios]
    to_email, cc_emails = obtener_destinatarios_to_y_cc(destinatarios_emails, nombre_colegio)

    filas_html = ""
    for alerta, alu in alertas:
        filas_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alu.nombre_completo}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alu.rut}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alu.curso}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #d9383a; font-weight: bold;">Presente en Taller / Ausente en Colegio</td>
        </tr>
        """

    html_content = f"""
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1e293b; color: white; padding: 16px; text-align: center;">
                <h2 style="margin: 0;">Alerta de Auditoria de Asistencia</h2>
                <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">{nombre_colegio}</p>
            </div>
            <div style="padding: 20px;">
                <p>Se ha cerrado la sesion del taller <strong>{nombre_taller}</strong> correspondiente al dia <strong>{sesion.fecha_sesion.strftime('%d/%m/%Y')}</strong> y se han detectado alumnos presentes en el taller que figuran ausentes en la asistencia regular del colegio:</p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left;">
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Alumno</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">RUT</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Curso</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Inconsistencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas_html}
                    </tbody>
                </table>

                <p style="margin-top: 24px; font-size: 13px; color: #64748b;">Este reporte ha sido generado automaticamente por el Sistema de Asistencia Extraescolar tras la confirmacion de la coordinacion.</p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart()
        msg["From"] = f"Sistema Extraescolar <{sender_email}>"
        msg["To"] = to_email
        if cc_emails:
            msg["Cc"] = ", ".join(cc_emails)
        msg["Subject"] = f"Alerta Asistencia: {nombre_taller} - {sesion.fecha_sesion.strftime('%d/%m/%Y')}"

        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()

        return {"status": "sent_success", "sent": True, "recipients": len(destinatarios_emails)}
    except Exception as e:
        print(f"Error despachando correo SMTP: {e}")
        return {"status": f"error: {str(e)}", "sent": False}


def enviar_reporte_global_smtp(db: Session, fecha_str: str, colegio_id: str):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import os
    from modules.asistencias.models import AlertaInconsistencia
    from modules.alumnos.models import Alumno
    from modules.correos.crud import get_correos_habilitados_by_colegio
    from modules.colegios.models import Colegio
    from modules.talleres.models import Taller
    from modules.sesiones.models import Sesion

    destinatarios = get_correos_habilitados_by_colegio(db, colegio_id)
    if not destinatarios:
        return {"status": "no_recipients", "sent": False}

    alertas_data = db.query(
        AlertaInconsistencia, Alumno, Taller
    ).join(
        Alumno, AlertaInconsistencia.alumno_id == Alumno.id
    ).join(
        Sesion, AlertaInconsistencia.sesion_id == Sesion.id
    ).join(
        Taller, Sesion.taller_id == Taller.id
    ).filter(
        AlertaInconsistencia.colegio_id == str(colegio_id),
        AlertaInconsistencia.fecha == fecha_str
    ).all()

    if not alertas_data:
        return {"status": "no_alerts", "sent": False}

    colegio = db.query(Colegio).filter(Colegio.id == str(colegio_id)).first()
    nombre_colegio = colegio.nombre_colegio if colegio else "Establecimiento"

    if "macaya" in nombre_colegio.lower():
        sender_email = settings.MC_SENDER_EMAIL or os.getenv("MC_SENDER_EMAIL")
        sender_password = settings.MC_SENDER_PASSWORD or os.getenv("MC_SENDER_PASSWORD")
    else:
        sender_email = settings.DP_SENDER_EMAIL or os.getenv("DP_SENDER_EMAIL")
        sender_password = settings.DP_SENDER_PASSWORD or os.getenv("DP_SENDER_PASSWORD")

    if not sender_email or not sender_password:
        return {"status": "missing_smtp_credentials", "sent": False}

    destinatarios_emails = [d.email for d in destinatarios]
    to_email, cc_emails = obtener_destinatarios_to_y_cc(destinatarios_emails, nombre_colegio)

    try:
        parts = fecha_str.split('-')
        fecha_desc = f"{parts[2]}/{parts[1]}/{parts[0]}"
    except Exception:
        fecha_desc = fecha_str

    filas_html = ""
    for alerta, alu, taller in alertas_data:
        filas_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alu.nombre_completo}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alu.rut}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alu.curso}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{taller.nombre_taller}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #d9383a; font-weight: bold;">Presente en Taller / Ausente en Colegio</td>
        </tr>
        """

    html_content = f"""
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1e293b; color: white; padding: 16px; text-align: center;">
                <h2 style="margin: 0;">Reporte Global de Auditoria de Asistencia</h2>
                <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">{nombre_colegio}</p>
            </div>
            <div style="padding: 20px;">
                <p>Se ha ejecutado el <strong>Cierre Global de Sesiones</strong> correspondiente a la fecha <strong>{fecha_desc}</strong>.
                A continuacion se detallan todas las inconsistencias detectadas:</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left;">
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Alumno</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">RUT</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Curso</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Taller</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Inconsistencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas_html}
                    </tbody>
                </table>
                <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
                    Generado automaticamente por el Sistema de Asistencia Extraescolar institucional.
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart()
        msg["From"] = f"Auditoria Extraescolar <{sender_email}>"
        msg["To"] = to_email
        if cc_emails:
            msg["Cc"] = ", ".join(cc_emails)
        msg["Subject"] = f"Reporte Consolidado Asistencia Extraescolar - {fecha_desc}"
        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()

        return {"status": "sent_success", "sent": True, "recipients": len(destinatarios_emails)}
    except Exception as e:
        print(f"Error despachando digest global SMTP: {e}")
        return {"status": f"error: {str(e)}", "sent": False}


def enviar_alerta_inconsistencia_individual(db: Session, sesion_id: UUID, alumno_id: str, colegio_id: str):
    """

    Envía un correo de alerta inmediata cuando el monitor marca como 'Asiste'
    a un alumno que figura como AUSENTE en el libro de clases del colegio.
    Los destinatarios se filtran por el dominio del correo según el colegio:
      - Colegio Macaya       → @colegiomacaya.cl
      - Colegio Diego Portales → @colegiodiegoportales.cl
    """
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import os
    from modules.alumnos.models import Alumno
    from modules.correos.crud import get_correos_habilitados_by_colegio
    from modules.colegios.models import Colegio
    from modules.talleres.models import Taller
    from modules.sesiones.models import Sesion
    from core.smtp_utils import obtener_destinatarios_to_y_cc

    # 1. Obtener datos de sesión, taller, colegio y alumno
    sesion = db.query(Sesion).filter(Sesion.id == str(sesion_id)).first()
    if not sesion:
        return {"status": "sesion_not_found", "sent": False}

    taller = db.query(Taller).filter(Taller.id == sesion.taller_id).first()
    nombre_taller = taller.nombre_taller if taller else "Taller Desconocido"

    alumno = db.query(Alumno).filter(Alumno.id == str(alumno_id)).first()
    if not alumno:
        return {"status": "alumno_not_found", "sent": False}

    colegio = db.query(Colegio).filter(Colegio.id == str(colegio_id)).first()
    nombre_colegio = colegio.nombre_colegio if colegio else ""

    # 2. Determinar dominio de correo y credenciales SMTP según el colegio
    nombre_lower = nombre_colegio.lower()
    if "macaya" in nombre_lower:
        dominio_filtro = "@colegiomacaya.cl"
        sender_email = settings.MC_SENDER_EMAIL or os.getenv("MC_SENDER_EMAIL")
        sender_password = settings.MC_SENDER_PASSWORD or os.getenv("MC_SENDER_PASSWORD")
    elif "portales" in nombre_lower or "diego" in nombre_lower:
        dominio_filtro = "@colegiodiegoportales.cl"
        sender_email = settings.DP_SENDER_EMAIL or os.getenv("DP_SENDER_EMAIL")
        sender_password = settings.DP_SENDER_PASSWORD or os.getenv("DP_SENDER_PASSWORD")
    else:
        # Colegio desconocido: usar todos los habilitados sin filtrar dominio
        dominio_filtro = None
        sender_email = settings.MC_SENDER_EMAIL or os.getenv("MC_SENDER_EMAIL")
        sender_password = settings.MC_SENDER_PASSWORD or os.getenv("MC_SENDER_PASSWORD")

    if not sender_email or not sender_password:
        print("Faltan credenciales SMTP en variables de entorno")
        return {"status": "missing_smtp_credentials", "sent": False}

    # 3. Obtener destinatarios habilitados explícitamente asignados al colegio
    destinatarios = get_correos_habilitados_by_colegio(db, colegio_id)

    if not destinatarios:
        print(f"No hay destinatarios habilitados registrados para el colegio {colegio_id}")
        return {"status": "no_recipients", "sent": False}

    destinatarios_emails = [d.email for d in destinatarios]
    to_email, cc_emails = obtener_destinatarios_to_y_cc(destinatarios_emails, nombre_colegio)

    # 4. Construir correo HTML
    fecha_str = sesion.fecha_sesion.strftime('%d/%m/%Y')

    html_content = f"""
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #b91c1c; color: white; padding: 20px; text-align: center;">
                <h2 style="margin: 0; font-size: 18px;">⚠️ Alerta de Inconsistencia de Asistencia</h2>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">{nombre_colegio}</p>
            </div>
            <div style="padding: 24px;">
                <p style="font-size: 14px; margin-top: 0;">
                    Se ha detectado una inconsistencia de asistencia en el taller
                    <strong>{nombre_taller}</strong> correspondiente al día <strong>{fecha_str}</strong>:
                </p>

                <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 16px; margin: 16px 0;">
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 4px 8px; color: #6b7280; font-weight: bold; width: 35%;">Alumno:</td>
                            <td style="padding: 4px 8px; font-weight: bold; color: #111827;">{alumno.nombre_completo}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 8px; color: #6b7280; font-weight: bold;">RUT:</td>
                            <td style="padding: 4px 8px; color: #374151;">{alumno.rut}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 8px; color: #6b7280; font-weight: bold;">Curso:</td>
                            <td style="padding: 4px 8px; color: #374151;">{alumno.curso}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 8px; color: #6b7280; font-weight: bold;">Taller:</td>
                            <td style="padding: 4px 8px; color: #374151;">{nombre_taller}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 8px; color: #6b7280; font-weight: bold;">Inconsistencia:</td>
                            <td style="padding: 4px 8px; color: #b91c1c; font-weight: bold;">
                                Presente en Taller · Ausente en Libro de Clases del Colegio
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
                    Este aviso ha sido generado <strong>automáticamente</strong> por el Sistema de Asistencia Extraescolar
                    al registrar al alumno como presente en el taller mientras figura como ausente en el
                    libro de clases del {nombre_colegio}.
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 8px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                    Si esta alerta es un error, contacte al coordinador del establecimiento para su revisión.
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    # 5. Enviar correo via SMTP
    try:
        msg = MIMEMultipart()
        msg["From"] = f"Sistema Extraescolar <{sender_email}>"
        msg["To"] = to_email
        if cc_emails:
            msg["Cc"] = ", ".join(cc_emails)
        msg["Subject"] = f"⚠️ Alerta Asistencia: {alumno.nombre_completo} — {nombre_taller} ({fecha_str})"

        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()

        print(f"Alerta individual enviada a Para: {to_email}, Cc: {cc_emails}")
        return {"status": "sent_success", "sent": True, "recipients": len(destinatarios_emails)}
    except Exception as e:
        print(f"Error despachando alerta individual SMTP: {e}")
        return {"status": f"error: {str(e)}", "sent": False}

