"""add notas_comportamiento table

Revision ID: 3b26f6b271fe
Revises: f52f5e655f8d
Create Date: 2026-06-02 13:08:12.160487

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3b26f6b271fe'
down_revision: Union[str, None] = 'f52f5e655f8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notas_comportamiento',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('colegio_id', sa.String(length=36), nullable=False),
        sa.Column('sesion_id', sa.String(length=36), nullable=False),
        sa.Column('alumno_id', sa.String(length=36), nullable=False),
        sa.Column('tipo', sa.Enum('bueno', 'malo', name='tipocomportamientoenum'), nullable=False),
        sa.Column('nota', sa.String(length=500), nullable=False),
        sa.Column('creado_por', sa.String(length=36), nullable=True),
        sa.Column('creado_at', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['alumno_id'], ['alumnos.id'], ),
        sa.ForeignKeyConstraint(['colegio_id'], ['colegios.id'], ),
        sa.ForeignKeyConstraint(['creado_por'], ['usuarios.id'], ),
        sa.ForeignKeyConstraint(['sesion_id'], ['sesiones.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('notas_comportamiento', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notas_comportamiento_colegio_id'), ['colegio_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('notas_comportamiento', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notas_comportamiento_colegio_id'))

    op.drop_table('notas_comportamiento')
