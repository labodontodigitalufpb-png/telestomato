"""add uploader_user_id to case_media

Revision ID: e4c9a2b7d1f0
Revises: d2b7f3a11c5e
Create Date: 2026-04-10 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e4c9a2b7d1f0"
down_revision = "d2b7f3a11c5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "case_media",
        sa.Column("uploader_user_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_case_media_uploader_user_id"),
        "case_media",
        ["uploader_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_case_media_uploader_user_id_users",
        "case_media",
        "users",
        ["uploader_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_case_media_uploader_user_id_users", "case_media", type_="foreignkey")
    op.drop_index(op.f("ix_case_media_uploader_user_id"), table_name="case_media")
    op.drop_column("case_media", "uploader_user_id")
