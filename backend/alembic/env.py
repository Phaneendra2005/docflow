from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from alembic import op  # noqa: F401
from sqlalchemy import pool
from sqlalchemy.engine import Connection

from app.config import settings
from app.database import Base

# Ensure models are imported so Alembic can see them.
from app.models.document import DocumentJob, ProcessedResult  # noqa: F401


config = context.config

import os

config.set_main_option(
    "sqlalchemy.url",
    os.getenv("DATABASE_URL")
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


import os

def get_url() -> str:
    return os.getenv("DATABASE_URL")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


from sqlalchemy.ext.asyncio import create_async_engine

async def run_migrations_online() -> None:
    connectable = create_async_engine(get_url())

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

