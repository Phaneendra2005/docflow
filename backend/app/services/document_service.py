from __future__ import annotations

import os
import re
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Any, Iterable

import aiofiles
from fastapi import UploadFile
from sqlalchemy import Select, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.document import DocumentJob, ProcessedResult, JobStatus


from app.worker.tasks import process_document

def _safe_filename(name: str) -> str:
    name = name.strip().replace(" ", "_")
    # Keep filename-ish chars; replace the rest.
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name or "document"


def _storage_path(job_id: str, safe_filename: str) -> str:
    return os.path.join(settings.UPLOAD_DIR, f"{job_id}_{safe_filename}")


async def create_job(db: AsyncSession, file: UploadFile, filename: str) -> DocumentJob:
    contents = await file.read()
    file_size = len(contents)
    if file_size > settings.MAX_FILE_SIZE:
        raise ValueError(f"File too large. Max allowed is {settings.MAX_FILE_SIZE} bytes.")

    job_id = str(uuid.uuid4())
    safe_filename = _safe_filename(filename)
    stored_path = _storage_path(job_id, safe_filename)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    async with aiofiles.open(stored_path, "wb") as f:
        await f.write(contents)

    file_type = file.content_type or "application/octet-stream"

    job = DocumentJob(
        id=job_id,
        filename=safe_filename,
        original_filename=filename,
        file_path=stored_path,
        file_size=file_size,
        file_type=file_type,
        status=JobStatus.queued,
        celery_task_id=None,
        error_message=None,
        retry_count=0,
    )

    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Enqueue Celery task.

    asyncio.create_task(process_document(job_id))
    
    await db.commit()
    await db.refresh(job)
    return job


async def get_job(db: AsyncSession, job_id: str) -> DocumentJob:
    stmt = (
        select(DocumentJob)
        .where(DocumentJob.id == job_id)
        .options(selectinload(DocumentJob.result))  # 🔥 ADD THIS
    )
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise LookupError(f"Job not found: {job_id}")
    return job


async def list_jobs(
    db: AsyncSession,
    search: str | None,
    status: str | None,
    sort_by: str,
    sort_order: str,
    skip: int,
    limit: int,
) -> tuple[list[DocumentJob], int, dict[str, int]]:

    # ---------------- BASE QUERY ----------------
    query = select(DocumentJob)

    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                DocumentJob.filename.ilike(like),
                DocumentJob.original_filename.ilike(like),
            )
        )

    if status:
        query = query.where(DocumentJob.status == JobStatus(status))

    # ---------------- SORT ----------------
    if sort_by == "name":
        sort_col = DocumentJob.filename
    elif sort_by == "updated_at":
        sort_col = DocumentJob.updated_at
    else:
        sort_col = DocumentJob.created_at

    order_by = sort_col.asc() if sort_order.lower() == "asc" else sort_col.desc()

    # ---------------- TOTAL ----------------
    total_res = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = int(total_res.scalar_one())

    # ---------------- FETCH JOBS ----------------
    jobs_res = await db.execute(
        query.order_by(order_by).offset(skip).limit(limit)
    )
    jobs = list(jobs_res.scalars().all())

    # ---------------- COUNTS ----------------
    counts = {}

    for st in JobStatus:
        res = await db.execute(
            select(func.count()).select_from(DocumentJob).where(DocumentJob.status == st)
        )
        counts[f"{st.value}_count"] = int(res.scalar_one())

    # ---------------- FINALIZED COUNT ----------------
    finalized_res = await db.execute(
        select(func.count())
        .select_from(DocumentJob)
        .join(ProcessedResult, DocumentJob.id == ProcessedResult.job_id)
        .where(ProcessedResult.is_finalized == True)
    )

    counts["finalized_count"] = int(finalized_res.scalar_one())

    return jobs, total, counts


async def retry_job(db: AsyncSession, job_id: str) -> DocumentJob:
    job = await get_job(db, job_id)
    if job.status != JobStatus.failed:
        raise ValueError("Only failed jobs can be retried.")

    job.status = JobStatus.queued
    job.error_message = None
    job.retry_count = (job.retry_count or 0) + 1
    job.celery_task_id = None

    # Clear existing result to reflect the new run.
    if job.result:
        await db.delete(job.result)
        job.result = None

    await db.commit()
    await db.refresh(job)

    asyncio.create_task(process_document(job_id))

    
    await db.commit()
    await db.refresh(job)
    return job


async def update_result(db: AsyncSession, job_id: str, updates: dict[str, Any]) -> ProcessedResult:
    job = await get_job(db, job_id)
    if not job.result:
        raise LookupError("Processed result not found.")

    result = job.result
    existing_edits = dict(result.user_edits or {})
    for key in ("title", "category", "summary", "keywords"):
        if key in updates:
            existing_edits[key] = updates[key]
    result.user_edits = existing_edits

    await db.commit()
    await db.refresh(result)
    return result


async def finalize_result(db: AsyncSession, job_id: str) -> ProcessedResult:
    job = await get_job(db, job_id)
    if not job.result:
        raise LookupError("Processed result not found.")

    if job.status != JobStatus.completed:
        raise ValueError("Only completed jobs can be finalized.")

    result = job.result
    result.is_finalized = True
    result.finalized_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(result)
    return result


async def delete_job(db: AsyncSession, job_id: str) -> None:
    job = await get_job(db, job_id)
    # Delete the stored file.
    try:
        if job.file_path and os.path.exists(job.file_path):
            os.remove(job.file_path)
    except Exception:
        # Best effort file cleanup.
        pass

    await db.delete(job)
    await db.commit()

