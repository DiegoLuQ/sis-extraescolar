import logging
import sys
from contextvars import ContextVar
from typing import Optional

# Almacena el ID del colegio para el contexto asíncrono de la petición actual
tenant_context_var: ContextVar[Optional[str]] = ContextVar("tenant_context", default="SYSTEM")

class TenantFilter(logging.Filter):
    """Agrega el tenant_id a cada registro de log."""
    def filter(self, record):
        tenant_id = tenant_context_var.get()
        record.tenant_id = tenant_id if tenant_id else "SYSTEM"
        return True

def setup_logging():
    logger = logging.getLogger("app")
    logger.setLevel(logging.INFO)
    
    # Evitar duplicar handlers si se llama varias veces
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        # El formato ahora incluye [%(tenant_id)s]
        formatter = logging.Formatter(
            '%(asctime)s - [%(tenant_id)s] - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        handler.addFilter(TenantFilter())
        logger.addHandler(handler)
    
    return logger

logger = setup_logging()
