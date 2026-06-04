"""add metas asistencia y fechas inscripcion

Revision ID: a1c2e3f4b5d6
Revises: 3b26f6b271fe
Create Date: 2026-06-03 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1c2e3f4b5d6'
down_revision: Union[str, None] = '3b26f6b271fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('colegios', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meta_asistencia', sa.Integer(), nullable=True))

    with op.batch_alter_table('talleres', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meta_asistencia', sa.Integer(), nullable=True))

    with op.batch_alter_table('inscripciones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('fecha_inscripcion', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('fecha_retiro', sa.Date(), nullable=True))

    # Default de meta para los colegios existentes.
    op.execute("UPDATE colegios SET meta_asistencia = 85 WHERE meta_asistencia IS NULL")


def downgrade() -> None:
    with op.batch_alter_table('inscripciones', schema=None) as batch_op:
        batch_op.drop_column('fecha_retiro')
        batch_op.drop_column('fecha_inscripcion')

    with op.batch_alter_table('talleres', schema=None) as batch_op:
        batch_op.drop_column('meta_asistencia')

    with op.batch_alter_table('colegios', schema=None) as batch_op:
        batch_op.drop_column('meta_asistencia')
