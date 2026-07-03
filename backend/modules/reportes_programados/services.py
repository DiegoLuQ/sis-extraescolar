import logging
import smtplib
from datetime import date, datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from core.smtp_utils import obtener_credenciales_smtp
from modules.colegios.models import Colegio
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia
from modules.reportes_programados.models import ReporteProgramado, FrecuenciaEnum
from modules.reportes_programados import crud

logger = logging.getLogger(__name__)

TIMEZONE = ZoneInfo("America/Santiago")

DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def hoy_chile() -> date:
    return datetime.now(TIMEZONE).date()


def calcular_periodo(frecuencia: FrecuenciaEnum, fecha_referencia: date) -> tuple[date, date, str]:
    """
    Calcula el rango [fecha_inicio, fecha_fin] a resumir según la frecuencia,
    tomando fecha_referencia como el día en que se ejecuta el envío (siempre 9am).
    """
    if frecuencia == FrecuenciaEnum.diario:
        ayer = fecha_referencia - timedelta(days=1)
        return ayer, ayer, f"Reporte diario - {ayer.strftime('%d/%m/%Y')}"

    if frecuencia == FrecuenciaEnum.semanal:
        lunes_actual = fecha_referencia - timedelta(days=fecha_referencia.weekday())
        lunes_pasado = lunes_actual - timedelta(days=7)
        viernes_pasado = lunes_pasado + timedelta(days=4)
        etiqueta = f"Semana del {lunes_pasado.strftime('%d/%m/%Y')} al {viernes_pasado.strftime('%d/%m/%Y')}"
        return lunes_pasado, viernes_pasado, etiqueta

    # mensual
    primer_dia_mes_actual = fecha_referencia.replace(day=1)
    ultimo_dia_mes_anterior = primer_dia_mes_actual - timedelta(days=1)
    primer_dia_mes_anterior = ultimo_dia_mes_anterior.replace(day=1)
    etiqueta = f"{MESES[primer_dia_mes_anterior.month - 1].capitalize()} {primer_dia_mes_anterior.year}"
    return primer_dia_mes_anterior, ultimo_dia_mes_anterior, etiqueta


def obtener_totales_periodo(db: Session, colegio_id: str, fecha_inicio: date, fecha_fin: date) -> dict:
    """
    Retorna los totales de asistencia (presente/ausente/justificado/atraso) por
    cada día hábil (lunes a viernes) del período, más una fila de totales.
    """
    rows = (
        db.query(Sesion.fecha_sesion, Asistencia.estado_asistencia, func.count(Asistencia.id))
        .execution_options(skip_tenant_filter=True)
        .join(Asistencia, Asistencia.sesion_id == Sesion.id)
        .filter(
            Sesion.colegio_id == str(colegio_id),
            Sesion.fecha_sesion >= fecha_inicio,
            Sesion.fecha_sesion <= fecha_fin,
        )
        .group_by(Sesion.fecha_sesion, Asistencia.estado_asistencia)
        .all()
    )

    conteos_por_dia: dict = {}
    for fecha_sesion, estado, cantidad in rows:
        estado_valor = estado.value if hasattr(estado, "value") else estado
        conteos_por_dia.setdefault(fecha_sesion, {"presente": 0, "ausente": 0, "justificado": 0, "atraso": 0})
        conteos_por_dia[fecha_sesion][estado_valor] = conteos_por_dia[fecha_sesion].get(estado_valor, 0) + cantidad

    filas = []
    totales = {"presente": 0, "ausente": 0, "justificado": 0, "atraso": 0}
    dia = fecha_inicio
    while dia <= fecha_fin:
        if dia.weekday() < 5:  # lunes(0) a viernes(4)
            conteo = conteos_por_dia.get(dia, {"presente": 0, "ausente": 0, "justificado": 0, "atraso": 0})
            filas.append({
                "fecha": dia.isoformat(),
                "dia_semana": DIAS_SEMANA[dia.weekday()],
                **conteo,
            })
            for key in totales:
                totales[key] += conteo.get(key, 0)
        dia += timedelta(days=1)

    return {"filas": filas, "totales": totales}


def construir_html_reporte(nombre_colegio: str, etiqueta_periodo: str, resultado: dict) -> str:
    filas_html = ""
    for fila in resultado["filas"]:
        filas_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">{fila['dia_semana']} {fila['fecha']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center; color: #16a34a;">{fila['presente']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center; color: #d9383a;">{fila['ausente']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">{fila['justificado']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">{fila['atraso']}</td>
        </tr>
        """

    totales = resultado["totales"]

    return f"""
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1e293b; color: white; padding: 16px; text-align: center;">
                <h2 style="margin: 0;">Reporte de Asistencia Extraescolar</h2>
                <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">{nombre_colegio} &mdash; {etiqueta_periodo}</p>
            </div>
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left;">
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Día</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: center;">Presentes</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: center;">Ausentes</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: center;">Justificados</th>
                            <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: center;">Atrasos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas_html}
                        <tr style="font-weight: bold; background-color: #f8fafc;">
                            <td style="padding: 8px;">Total</td>
                            <td style="padding: 8px; text-align: center; color: #16a34a;">{totales['presente']}</td>
                            <td style="padding: 8px; text-align: center; color: #d9383a;">{totales['ausente']}</td>
                            <td style="padding: 8px; text-align: center;">{totales['justificado']}</td>
                            <td style="padding: 8px; text-align: center;">{totales['atraso']}</td>
                        </tr>
                    </tbody>
                </table>
                <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
                    Generado automáticamente por el Sistema de Asistencia Extraescolar institucional.
                </p>
            </div>
        </div>
    </body>
    </html>
    """


def generar_preview_html(db: Session, colegio_id: str, frecuencia: FrecuenciaEnum, fecha_referencia: date = None) -> dict:
    """
    Genera el HTML del reporte (mismo cuerpo que se enviaría por correo) para
    el colegio y frecuencia indicados, sin enviar ningún email. Útil para
    mostrar una vista previa en el formulario de creación/edición.
    """
    fecha_referencia = fecha_referencia or hoy_chile()
    colegio = db.query(Colegio).filter(Colegio.id == str(colegio_id)).first()
    nombre_colegio = colegio.nombre_colegio if colegio else "Establecimiento"

    fecha_inicio, fecha_fin, etiqueta_periodo = calcular_periodo(frecuencia, fecha_referencia)
    totales = obtener_totales_periodo(db, colegio_id, fecha_inicio, fecha_fin)
    html_content = construir_html_reporte(nombre_colegio, etiqueta_periodo, totales)

    return {"html": html_content, "etiqueta_periodo": etiqueta_periodo}


def enviar_reporte(db: Session, reporte: ReporteProgramado, fecha_referencia: date) -> dict:
    """
    Calcula el período correspondiente a la frecuencia del reporte, arma el HTML
    y lo envía por SMTP a sus destinatarios. Usado tanto por el scheduler como
    por el botón de envío manual.
    """
    colegio = db.query(Colegio).filter(Colegio.id == str(reporte.colegio_id)).first()
    nombre_colegio = colegio.nombre_colegio if colegio else "Establecimiento"

    destinatarios = reporte.destinatarios or []
    if not destinatarios:
        resultado = {"status": "no_recipients", "sent": False}
        crud.marcar_ejecucion(db, reporte.id, fecha_referencia.isoformat(), resultado["status"])
        return resultado

    sender_email, sender_password = obtener_credenciales_smtp(nombre_colegio)
    if not sender_email or not sender_password:
        resultado = {"status": "missing_smtp_credentials", "sent": False}
        crud.marcar_ejecucion(db, reporte.id, fecha_referencia.isoformat(), resultado["status"])
        return resultado

    fecha_inicio, fecha_fin, etiqueta_periodo = calcular_periodo(reporte.frecuencia, fecha_referencia)
    totales = obtener_totales_periodo(db, reporte.colegio_id, fecha_inicio, fecha_fin)
    html_content = construir_html_reporte(nombre_colegio, etiqueta_periodo, totales)

    try:
        msg = MIMEMultipart()
        msg["From"] = f"Reportes Extraescolar <{sender_email}>"
        msg["To"] = ", ".join(destinatarios)
        msg["Subject"] = f"Reporte de Asistencia Extraescolar - {etiqueta_periodo}"
        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()

        resultado = {"status": "sent_success", "sent": True, "recipients": len(destinatarios)}
    except Exception as e:
        logger.exception(f"Error enviando reporte programado {reporte.id}")
        resultado = {"status": f"error: {str(e)}", "sent": False}

    crud.marcar_ejecucion(db, reporte.id, fecha_referencia.isoformat(), resultado["status"])
    return resultado


def ejecutar_pendientes(db: Session) -> dict:
    """
    Revisa todos los reportes activos y envía los que correspondan según su
    frecuencia para el día de hoy (hora de Chile). Se llama una vez al día a
    las 9am desde el scheduler. Usa ultima_ejecucion como guardia de
    idempotencia por si el proceso se reinicia el mismo día.
    """
    hoy = hoy_chile()
    hoy_str = hoy.isoformat()

    reportes = (
        db.query(ReporteProgramado)
        .execution_options(skip_tenant_filter=True)
        .filter(ReporteProgramado.activo == True)
        .all()
    )

    ejecutados = 0
    for reporte in reportes:
        if reporte.ultima_ejecucion == hoy_str:
            continue

        if reporte.frecuencia == FrecuenciaEnum.diario:
            debe_ejecutar = True
        elif reporte.frecuencia == FrecuenciaEnum.semanal:
            debe_ejecutar = hoy.weekday() == 0
        else:  # mensual
            debe_ejecutar = hoy.day == 1

        if debe_ejecutar:
            enviar_reporte(db, reporte, hoy)
            ejecutados += 1

    return {"revisados": len(reportes), "ejecutados": ejecutados}
