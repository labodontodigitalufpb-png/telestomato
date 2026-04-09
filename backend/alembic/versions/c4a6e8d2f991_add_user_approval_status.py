"""add user approval status

Revision ID: c4a6e8d2f991
Revises: b7c3d9f1a2e4
Create Date: 2026-04-08 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c4a6e8d2f991"
down_revision: Union[str, Sequence[str], None] = "b7c3d9f1a2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


approval_status = postgresql.ENUM(
    "approved",
    "pending",
    "rejected",
    name="approvalstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    approval_status.create(bind, checkfirst=True)
    op.add_column(
        "users",
        sa.Column("approval_status", approval_status, nullable=False, server_default="approved"),
    )
    op.add_column("users", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("users", "approval_status", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "approved_at")
    op.drop_column("users", "approval_status")
    bind = op.get_bind()
    approval_status.drop(bind, checkfirst=True)
