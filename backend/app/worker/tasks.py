from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import async_session_factory
from app.models.document import DocumentJob, ProcessedResult, JobStatus


# ---------------- HELPER FUNCTIONS ----------------

def _derive_title(filename: str) -> str:
    base = os.path.splitext(filename)[0]
    base = base.replace("_", " ").replace("-", " ")
    return base.strip() or "Untitled Document"


def _pick_category(file_type: str, ext: str) -> str:
    ext = ext.lower()
    if ext == ".pdf":
        return "PDF Document"
    if ext in [".txt", ".md"]:
        return "Text File"
    if ext == ".docx":
        return "Word Document"
    return "Other"


def _mock_summary(category: str, title: str) -> str:
    return f"This {category.lower()} titled '{title}' contains structured extracted information."


def _tokenize(text: str):
    return [w for w in text.lower().split() if len(w) > 2][:5]


# ---------------- MAIN FUNCTION ----------------

async def process_document(job_id: str):
    async with async_session_factory() as session:

        # 🔹 Fetch job
        result = await session.execute(
            select(DocumentJob).where(DocumentJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            return

        # 🔹 Mark processing
        job.status = JobStatus.processing
        job.error_message = None
        await session.commit()

        # 🔹 Validate file
        if not os.path.exists(job.file_path):
            job.status = JobStatus.failed
            job.error_message = "File not found"
            await session.commit()
            return

        # ---------------- PROCESSING ----------------

        title = _derive_title(job.filename)
        ext = os.path.splitext(job.filename)[1]
        category = _pick_category(job.file_type, ext)

        raw_text = f"Processed content for {job.filename}"
        keywords = _tokenize(job.filename)

        extracted_metadata = {
            "filename": job.filename,
            "file_size": job.file_size,
            "file_type": job.file_type,
        }

        summary = _mock_summary(category, title)

        # 🔹 Check existing result
        res = await session.execute(
            select(ProcessedResult).where(ProcessedResult.job_id == job_id)
        )
        existing = res.scalar_one_or_none()

        if existing:
            existing.title = title
            existing.category = category
            existing.summary = summary
            existing.keywords = keywords
            existing.extracted_metadata = extracted_metadata
            existing.raw_text = raw_text
        else:
            new_result = ProcessedResult(
                job_id=job_id,
                title=title,
                category=category,
                summary=summary,
                keywords=keywords,
                extracted_metadata=extracted_metadata,
                raw_text=raw_text,
            )
            session.add(new_result)

        # 🔹 Mark completed
        job.status = JobStatus.completed
        job.error_message = None

        await session.commit()