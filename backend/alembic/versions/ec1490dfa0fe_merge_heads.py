"""merge heads

Revision ID: ec1490dfa0fe
Revises: 789ff2e253d3, c1d2e3f4a5b6
Create Date: 2026-05-27 14:48:18.908172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec1490dfa0fe'
down_revision: Union[str, None] = ('789ff2e253d3', 'c1d2e3f4a5b6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
