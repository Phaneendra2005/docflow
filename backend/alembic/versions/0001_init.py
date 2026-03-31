from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

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
    job_status_enum = postgresql.ENUM(
        "queued", "processing", "completed", "failed",
        name="job_status",
        create_type=False
    )

    op.create_table(
        "document_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("status", job_status_enum, nullable=False, server_default="queued"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("celery_task_id", sa.String(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
    )

    op.create_table(
        "processed_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False, server_default=""),
        sa.Column("category", sa.String(), nullable=False, server_default=""),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("keywords", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("extracted_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("raw_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_finalized", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_edits", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
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