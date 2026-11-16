"""add_sesiones_anio_to_talleres

Revision ID: d4e5f6a7b8c9
Revises: 8b1cc8f960ec
Create Date: 2026-11-16 13:23:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = '8b1cc8f960ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('talleres', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sesiones_anio', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('talleres', schema=None) as batch_op:
        batch_op.drop_column('sesiones_anio')
