"""add case_media table

Revision ID: 4fe8197c21be
Revises: 684341ff0b23
Create Date: 2026-02-04 15:18:08.490058

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fe8197c21be'
down_revision: Union[str, Sequence[str], None] = '684341ff0b23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Esta revisão foi mantida como no-op para preservar o histórico.
    A tabela `case_media` já passou a ser criada na revisão anterior
    `684341ff0b23_create_clinical_cases_and_media`.
    """
    return None


def downgrade() -> None:
    """Downgrade schema."""
    return None
