from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create ENUM safely (only once)
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    """)

    # 2. Use PostgreSQL ENUM WITHOUT auto-create

    op.create_table(
        "document_jobs",

        sa.Column("id", sa.String(), primary_key=True, nullable=False),

        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),

        # ENUM → STRING
        sa.Column("status", sa.String(), nullable=False, server_default="queued"),

        # REMOVE now()
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),

        sa.Column("celery_task_id", sa.String(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),

        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "processed_results",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),

        sa.Column("title", sa.String(), nullable=False, server_default=""),
        sa.Column("category", sa.String(), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),

        sa.Column("keywords", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("extracted_metadata", sa.JSON(), nullable=False, server_default="{}"),

        sa.Column("raw_text", sa.Text(), nullable=False, server_default=""),

        sa.Column("is_finalized", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("finalized_at", sa.DateTime(), nullable=True),

        sa.Column("user_edits", sa.JSON(), nullable=True),

        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),

        sa.ForeignKeyConstraint(["job_id"], ["document_jobs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("job_id"),
    )


def downgrade() -> None:
    op.drop_table("processed_results")
    op.drop_table("document_jobs")

    op.execute("""
    DO $$ BEGIN
        DROP TYPE job_status;
    EXCEPTION
        WHEN undefined_object THEN null;
    END $$;
    """)