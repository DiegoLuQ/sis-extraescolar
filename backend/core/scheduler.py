import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from core.database import SessionLocal

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="America/Santiago")


def _ejecutar_reportes_programados_job():
    from modules.reportes_programados import services

    db = SessionLocal()
    try:
        resultado = services.ejecutar_pendientes(db)
        logger.info(f"Reportes programados: {resultado['ejecutados']}/{resultado['revisados']} enviados")
    except Exception:
        logger.exception("Error ejecutando reportes programados")
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(
        _ejecutar_reportes_programados_job,
        trigger=CronTrigger(hour=9, minute=0, timezone="America/Santiago"),
        id="reportes_programados_9am",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Scheduler de reportes programados iniciado (job diario 09:00 America/Santiago)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
