"""rename rut to nombre in usuarios

Revision ID: b2c3d4e5f6a7
Revises: 0a4a5d8c78a4
Create Date: 2026-04-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = '0a4a5d8c78a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_usuarios_rut_colegio', table_name='usuarios')
    op.alter_column('usuarios', 'rut', new_column_name='nombre',
                    existing_type=sa.String(length=20), nullable=False)
    op.create_index('ix_usuarios_nombre_colegio', 'usuarios', ['nombre', 'colegio_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_usuarios_nombre_colegio', table_name='usuarios')
    op.alter_column('usuarios', 'nombre', new_column_name='rut',
                    existing_type=sa.String(length=20), nullable=False)
    op.create_index('ix_usuarios_rut_colegio', 'usuarios', ['rut', 'colegio_id'], unique=True)
