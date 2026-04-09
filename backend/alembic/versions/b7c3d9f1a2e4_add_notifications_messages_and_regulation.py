"""add notifications messages and regulation

Revision ID: b7c3d9f1a2e4
Revises: 91d6a5b8c2f1
Create Date: 2026-04-08 18:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b7c3d9f1a2e4"
down_revision: Union[str, Sequence[str], None] = "91d6a5b8c2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


notification_type = postgresql.ENUM(
    "consultant_answer",
    "new_message",
    "regulation_update",
    "regulation_pending",
    name="notificationtype",
    create_type=False,
)

regulation_status = postgresql.ENUM(
    "none",
    "pending",
    "in_review",
    "completed",
    name="regulationstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    notification_type.create(bind, checkfirst=True)
    regulation_status.create(bind, checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("notification_type", notification_type, nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["clinical_cases.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_notifications_case_id"), "notifications", ["case_id"], unique=False)

    op.create_table(
        "case_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("author_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["clinical_cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_case_messages_id"), "case_messages", ["id"], unique=False)
    op.create_index(op.f("ix_case_messages_case_id"), "case_messages", ["case_id"], unique=False)
    op.create_index(op.f("ix_case_messages_author_user_id"), "case_messages", ["author_user_id"], unique=False)

    op.add_column("clinical_cases", sa.Column("regulator_user_id", sa.Integer(), nullable=True))
    op.add_column(
        "clinical_cases",
        sa.Column("regulation_status", regulation_status, nullable=False, server_default="none"),
    )
    op.add_column("clinical_cases", sa.Column("regulation_notes", sa.Text(), nullable=True))
    op.add_column("clinical_cases", sa.Column("regulated_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_clinical_cases_regulator_user_id"), "clinical_cases", ["regulator_user_id"], unique=False)
    op.create_index(op.f("ix_clinical_cases_regulation_status"), "clinical_cases", ["regulation_status"], unique=False)
    op.create_foreign_key(
        "fk_clinical_cases_regulator_user_id_users",
        "clinical_cases",
        "users",
        ["regulator_user_id"],
        ["id"],
    )
    op.alter_column("clinical_cases", "regulation_status", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_clinical_cases_regulator_user_id_users", "clinical_cases", type_="foreignkey")
    op.drop_index(op.f("ix_clinical_cases_regulation_status"), table_name="clinical_cases")
    op.drop_index(op.f("ix_clinical_cases_regulator_user_id"), table_name="clinical_cases")
    op.drop_column("clinical_cases", "regulated_at")
    op.drop_column("clinical_cases", "regulation_notes")
    op.drop_column("clinical_cases", "regulation_status")
    op.drop_column("clinical_cases", "regulator_user_id")

    op.drop_index(op.f("ix_case_messages_author_user_id"), table_name="case_messages")
    op.drop_index(op.f("ix_case_messages_case_id"), table_name="case_messages")
    op.drop_index(op.f("ix_case_messages_id"), table_name="case_messages")
    op.drop_table("case_messages")

    op.drop_index(op.f("ix_notifications_case_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_id"), table_name="notifications")
    op.drop_table("notifications")

    bind = op.get_bind()
    regulation_status.drop(bind, checkfirst=True)
    notification_type.drop(bind, checkfirst=True)
