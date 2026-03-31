from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any

from app.models.document import DocumentJob, ProcessedResult


def _effective_result(result: ProcessedResult) -> dict[str, Any]:
    edits = result.user_edits or {}
    return {
        "title": edits.get("title", result.title),
        "category": edits.get("category", result.category),
        "summary": edits.get("summary", result.summary),
        "keywords": edits.get("keywords", result.keywords),
    }


def export_as_json(job: DocumentJob) -> dict[str, Any]:
    if not job.result:
        raise ValueError("Processed result not found.")

    effective = _effective_result(job.result)
    return {
        "job": {
            "id": str(job.id),
            "filename": job.filename,
            "original_filename": job.original_filename,
            "file_path": job.file_path,
            "file_size": job.file_size,
            "file_type": job.file_type,
            "status": job.status.value if hasattr(job.status, "value") else str(job.status),
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None,
            "celery_task_id": job.celery_task_id,
            "error_message": job.error_message,
            "retry_count": job.retry_count,
        },
        "result": {
            "id": str(job.result.id),
            "job_id": str(job.result.job_id),
            "extracted_metadata": job.result.extracted_metadata,
            "raw_text": job.result.raw_text,
            "is_finalized": job.result.is_finalized,
            "finalized_at": job.result.finalized_at.isoformat() if job.result.finalized_at else None,
            "user_edits": job.result.user_edits,
            "effective": effective,
        },
    }


def export_as_csv(jobs: list[DocumentJob]) -> str:
    fieldnames = [
        "job_id",
        "filename",
        "file_type",
        "status",
        "created_at",
        "retry_count",
        "title",
        "category",
        "summary",
        "keywords",
        "finalized_at",
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()

    for job in jobs:
        if not job.result:
            continue
        if not job.result.is_finalized:
            continue

        effective = _effective_result(job.result)
        writer.writerow(
            {
                "job_id": str(job.id),
                "filename": job.filename,
                "file_type": job.file_type,
                "status": job.status.value if hasattr(job.status, "value") else str(job.status),
                "created_at": job.created_at.isoformat() if job.created_at else "",
                "retry_count": job.retry_count,
                "title": effective["title"],
                "category": effective["category"],
                "summary": effective["summary"],
                "keywords": ";".join(effective["keywords"] or []),
                "finalized_at": job.result.finalized_at.isoformat() if job.result.finalized_at else "",
            }
        )

    return output.getvalue()

