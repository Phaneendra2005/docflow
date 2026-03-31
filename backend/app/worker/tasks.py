from __future__ import annotations

import os
import random
import re
import time
import uuid
from datetime import datetime, timezone

from celery import Task
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.pubsub import publish_progress
from app.models.document import DocumentJob, ProcessedResult, JobStatus

from .celery_app import celery_app


def _get_sync_engine():
    # DATABASE_URL is expected to be postgresql+asyncpg://...; convert for Celery/worker.
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    return create_engine(url, pool_pre_ping=True)


_sync_engine = _get_sync_engine()
_SyncSessionLocal = sessionmaker(bind=_sync_engine, autoflush=False, autocommit=False)


def _tokenize(text: str) -> list[str]:
    parts = re.split(r"[^A-Za-z0-9]+", text.lower())
    stop = {"the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "were", "will", "have", "has", "not", "you", "your", "our"}
    return [p for p in parts if p and p not in stop and len(p) > 2]


def _derive_title(filename: str) -> str:
    base = os.path.splitext(filename)[0]
    base = base.replace("_", " ").replace("-", " ")
    base = re.sub(r"\s+", " ", base).strip()
    return base[:120] if base else "Untitled Document"


def _pick_category(file_type: str, ext: str) -> str:
    ext = ext.lower()
    if ext == ".pdf":
        return "PDF Document"
    if ext == ".txt" or ext == ".md":
        return "Text File"
    if ext == ".docx":
        return "Word Document"
    if ext == ".csv":
        return "Spreadsheet"
    if ext == ".json":
        return "Data File"
    if file_type.lower().startswith("application/") or file_type.lower().endswith("json"):
        return "Other"
    return "Other"


def _mock_summary(category: str, title: str) -> str:
    return (
        f"This {category.lower()} titled \"{title}\" summarizes key points and provides a structured overview "
        f"of the main information contained in the source. The document highlights important themes, "
        f"relevant entities, and notable observations that can be used for downstream review, editing, "
        f"and export."
    )


def process_document(job_id: str):
    """
    Main Celery task for document processing.

    Progress events are published to Redis Pub/Sub channel: job_progress:{job_id}
    """
    max_attempts = 3
    base_backoff_s = 2

    for attempt in range(1, max_attempts + 1):
        try:
            publish_progress(job_id=job_id, event_type="job_started", data={}, progress_percent=0)

            job_uuid = uuid.UUID(job_id)
            session = _SyncSessionLocal()

            try:
                job = session.get(DocumentJob, job_uuid)
                if not job:
                    raise ValueError(f"Job not found: {job_id}")

                job.status = JobStatus.processing
                job.error_message = None
                session.commit()

                publish_progress(
                    job_id=job_id,
                    event_type="document_parsing_started",
                    data={"message": "Parsing document contents."},
                    progress_percent=10,
                )

                file_abs_path = job.file_path
                if not os.path.exists(file_abs_path):
                    raise FileNotFoundError(f"Stored file not found: {file_abs_path}")

                _, ext = os.path.splitext(job.filename)
                ext = ext.lower()

                # Simulate parsing delay.
                time.sleep(random.uniform(1.0, 2.0))

                raw_text: str
                if ext in {".txt", ".md"}:
                    with open(file_abs_path, "r", encoding="utf-8", errors="ignore") as f:
                        raw_text = f.read()
                else:
                    raw_text = f"Mock content derived from filename: {job.filename}"

                publish_progress(
                    job_id=job_id,
                    event_type="document_parsing_completed",
                    data={"message": "Document parsing completed."},
                    progress_percent=35,
                )

                publish_progress(
                    job_id=job_id,
                    event_type="field_extraction_started",
                    data={"message": "Extracting fields from document."},
                    progress_percent=40,
                )

                title = _derive_title(job.filename)
                category = _pick_category(job.file_type, ext)

                content_tokens = _tokenize(raw_text + " " + job.filename)
                filename_tokens = _tokenize(job.filename)
                combined_tokens = filename_tokens + content_tokens

                unique = []
                seen = set()
                for t in combined_tokens:
                    if t not in seen:
                        unique.append(t)
                        seen.add(t)

                # Choose 5-8 keywords.
                kw_count = 5 if len(unique) < 5 else random.randint(5, 8)
                keywords = unique[:kw_count]

                # Ensure minimum size.
                while len(keywords) < 5:
                    keywords.append(random.choice(["analysis", "overview", "summary", "insights", "key-points", "highlights"]))
                    keywords = list(dict.fromkeys(keywords))

                start_ts = datetime.now(timezone.utc)
                processing_time_s = max(0.1, (datetime.now(timezone.utc) - start_ts).total_seconds())

                word_count_mock = max(120, len(_tokenize(raw_text)) * 25) if raw_text else 200
                page_count_mock = max(1, int(job.file_size / 25000) + 1) if job.file_size else 1

                extracted_metadata = {
                    "filename": job.filename,
                    "file_size": job.file_size,
                    "file_type": job.file_type,
                    "page_count": page_count_mock,
                    "word_count": word_count_mock,
                    "processing_time": processing_time_s,
                }

                summary = _mock_summary(category=category, title=title)

                publish_progress(
                    job_id=job_id,
                    event_type="field_extraction_completed",
                    data={"message": "Field extraction completed."},
                    progress_percent=75,
                )

                # Save or update ProcessedResult.
                existing = (
                    session.query(ProcessedResult)
                    .filter(ProcessedResult.job_id == job_uuid)
                    .one_or_none()
                )

                if existing:
                    existing.title = title
                    existing.category = category
                    existing.summary = summary
                    existing.keywords = keywords
                    existing.extracted_metadata = extracted_metadata
                    existing.raw_text = raw_text
                    existing.is_finalized = existing.is_finalized
                    existing.finalized_at = existing.finalized_at
                    existing.user_edits = existing.user_edits
                else:
                    existing = ProcessedResult(
                        job_id=job_uuid,
                        title=title,
                        category=category,
                        summary=summary,
                        keywords=keywords,
                        extracted_metadata=extracted_metadata,
                        raw_text=raw_text,
                    )
                    session.add(existing)

                job.status = JobStatus.completed
                job.error_message = None

                session.commit()

                publish_progress(
                    job_id=job_id,
                    event_type="job_completed",
                    data={"message": "Job completed successfully."},
                    progress_percent=100,
                )
                return

            finally:
                session.close()
        except Exception as exc:
            # Retry with exponential backoff; only mark the job failed on final attempt.
            if attempt < max_attempts:
                backoff_s = base_backoff_s * (2 ** (attempt - 1))
                time.sleep(backoff_s + random.uniform(0, 1))
                continue

            try:
                session = _SyncSessionLocal()
                try:
                    job_uuid = uuid.UUID(job_id)
                    job = session.get(DocumentJob, job_uuid)
                    if job:
                        job.status = JobStatus.failed
                        job.error_message = str(exc)
                        session.commit()
                finally:
                    session.close()
            finally:
                publish_progress(
                    job_id=job_id,
                    event_type="job_failed",
                    data={"message": str(exc)},
                    progress_percent=100,
                )

            # Stop Celery retries; state is already updated.
            return

