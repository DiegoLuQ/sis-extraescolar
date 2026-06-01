"""expand nombre column in usuarios to varchar(100)

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-05-27 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('usuarios', 'nombre',
                    existing_type=sa.String(length=20),
                    type_=sa.String(length=100),
                    nullable=False)


def downgrade() -> None:
    op.alter_column('usuarios', 'nombre',
                    existing_type=sa.String(length=100),
                    type_=sa.String(length=20),
                    nullable=False)
