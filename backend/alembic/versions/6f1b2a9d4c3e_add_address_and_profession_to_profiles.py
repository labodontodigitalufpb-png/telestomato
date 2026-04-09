"""add address and profession to professional profiles

Revision ID: 6f1b2a9d4c3e
Revises: e8b3d4c1f7aa
Create Date: 2026-04-08 23:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6f1b2a9d4c3e"
down_revision: Union[str, Sequence[str], None] = "e8b3d4c1f7aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not has_column(inspector, "professional_profiles", "address"):
        op.add_column("professional_profiles", sa.Column("address", sa.String(length=255), nullable=True))

    if not has_column(inspector, "professional_profiles", "profession"):
        op.add_column("professional_profiles", sa.Column("profession", sa.String(length=120), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if has_column(inspector, "professional_profiles", "profession"):
        op.drop_column("professional_profiles", "profession")

    if has_column(inspector, "professional_profiles", "address"):
        op.drop_column("professional_profiles", "address")
