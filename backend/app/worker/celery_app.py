from __future__ import annotations

from celery import Celery

from app.config import settings


def make_celery_app() -> Celery:
   # broker_url = settings.CELERY_BROKER_URL or settings.REDIS_URL
   # result_backend = settings.CELERY_RESULT_BACKEND or settings.REDIS_URL

    celery_app = Celery(
        "docflow",
        broker=broker_url,
        backend=result_backend,
    )
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
    )
    return celery_app


celery_app = make_celery_app()

# Import tasks so Celery registers them when the worker starts.
import app.worker.tasks  # noqa: E402,F401


