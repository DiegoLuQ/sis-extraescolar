from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from modules.colegios.models import Colegio
from modules.usuarios.models import Usuario
from modules.alumnos.models import Alumno
from modules.talleres.models import Taller
from modules.inscripciones.models import Inscripcion
from modules.sesiones.models import Sesion
from modules.asistencias.models import Asistencia
from modules.roles.models import Rol, Permiso
from modules.correos.models import CorreoReporte
from core.database import Base
from core.config import settings

config = context.config

# Usar la URL de la base de datos desde la configuración de la app (variable de
# entorno DATABASE_URL) en lugar del valor hardcodeado en alembic.ini. Esto permite
# que las migraciones funcionen correctamente dentro de Docker, donde el host de la
# BD no es "localhost". Se escapa "%" para evitar errores de interpolación de ConfigParser.
if settings.DATABASE_URL:
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=False,
            render_as_batch=True
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
