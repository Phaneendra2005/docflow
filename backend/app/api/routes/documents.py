from __future__ import annotations

from fastapi.responses import StreamingResponse
import io
import json
import csv

import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.document import DocumentJob, ProcessedResult, JobStatus
from app.schemas.document import (
    DocumentJobListResponse,
    DocumentJobResponse,
    ListResponse,
    ProcessedResultUpdate,
)
from app.services import document_service


router = APIRouter()

SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx", ".csv", ".json"}


# -------------------------------
# HELPER
# -------------------------------
def _ext_from_filename(name: str) -> str:
    _, ext = os.path.splitext(name)
    return ext.lower()


# -------------------------------
# UPLOAD
# -------------------------------
@router.post("/upload", response_model=list[DocumentJobResponse])
async def upload_documents(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files provided.")

        jobs: list[DocumentJob] = []

        for f in files:
            ext = _ext_from_filename(f.filename or "")
            if ext not in SUPPORTED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type for '{f.filename}'",
                )

            job = await document_service.create_job(
                db=db,
                file=f,
                filename=f.filename
            )
            jobs.append(job)

        # 🔥 SAFE RESPONSE (no lazy loading)
        return [
            DocumentJobResponse(
                id=j.id,
                filename=j.filename,
                original_filename=j.original_filename,
                file_path=j.file_path,
                file_size=j.file_size,
                file_type=j.file_type,
                status=j.status,
                celery_task_id=j.celery_task_id,
                error_message=j.error_message,
                retry_count=j.retry_count,
                created_at=j.created_at,
                updated_at=j.updated_at,
            )
            for j in jobs
        ]

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")


# -------------------------------
# LIST (DASHBOARD)
# -------------------------------
@router.get("", response_model=ListResponse)
async def list_documents(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    skip: int = Query(default=0),
    limit: int = Query(default=10),
    db: AsyncSession = Depends(get_db),
):
    try:
        jobs, total, counts = await document_service.list_jobs(
            db=db,
            search=search,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=limit,
        )

        return {
            "items": [DocumentJobListResponse.model_validate(j) for j in jobs],
            "total": total,
            "queued_count": counts.get("queued_count", 0),
            "processing_count": counts.get("processing_count", 0),
            "completed_count": counts.get("completed_count", 0),
            "failed_count": counts.get("failed_count", 0),
            "finalized_count": counts.get("finalized_count", 0),  # 🔥 MUST EXIST
            "skip": skip,
            "limit": limit,
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# -------------------------------
# DETAIL PAGE (IMPORTANT FIX)
# -------------------------------
@router.get("/{id}")
async def get_document(id: str, db: AsyncSession = Depends(get_db)):
    try:
        job_id = uuid.UUID(id)

        # get job
        result = await db.execute(
            select(DocumentJob).where(DocumentJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Document not found")

        # 🔥 get processed result
        result_obj = await db.execute(
            select(ProcessedResult).where(ProcessedResult.job_id == job_id)
        )
        processed = result_obj.scalar_one_or_none()

        return {
            "id": job.id,
            "filename": job.filename,
            "original_filename": job.original_filename,
            "file_path": job.file_path,
            "file_size": job.file_size,
            "file_type": job.file_type,
            "status": job.status.value if job.status else None,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "result": {
                "title": job.result.title,
                "category": job.result.category,
                "summary": job.result.summary,
                "keywords": job.result.keywords,
                "is_finalized": job.result.is_finalized,
            } if job.result else None
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job id")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# -------------------------------
# UPDATE RESULT (EDIT/SAVE)
# -------------------------------
@router.put("/{id}/result")
async def update_result(
    id: str,
    updates: ProcessedResultUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        job_id = uuid.UUID(id)

        update_dict = {
            k: v for k, v in updates.model_dump().items() if v is not None
        }

        await document_service.update_result(
            db=db,
            job_id=job_id,
            updates=update_dict,
        )

        return {"message": "Updated successfully"}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# -------------------------------
# FINALIZE
# -------------------------------
@router.post("/{id}/finalize")
async def finalize_result(id: str, db: AsyncSession = Depends(get_db)):
    try:
        job_id = uuid.UUID(id)

        await document_service.finalize_result(db=db, job_id=job_id)

        return {"message": "Finalized successfully"}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# -------------------------------
# EXPORT JSON
# -------------------------------
@router.get("/{id}/export/json")
async def export_json(id: str, db: AsyncSession = Depends(get_db)):
    try:
        job_id = uuid.UUID(id)

        result = await db.execute(
            select(ProcessedResult).where(ProcessedResult.job_id == job_id)
        )
        processed = result.scalar_one_or_none()

        if not processed:
            raise HTTPException(status_code=404, detail="No processed data found")

        data = {
            "title": processed.title,
            "category": processed.category,
            "summary": processed.summary,
            "keywords": processed.keywords,
            "metadata": processed.extracted_metadata,
            "raw_text": processed.raw_text,
        }

        json_bytes = json.dumps(data, indent=2).encode("utf-8")

        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=document_{id}.json"
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------
# EXPORT CSV
# -------------------------------
@router.get("/{id}/export/csv")
async def export_csv(id: str, db: AsyncSession = Depends(get_db)):
    try:
        job_id = uuid.UUID(id)

        result = await db.execute(
            select(ProcessedResult).where(ProcessedResult.job_id == job_id)
        )
        processed = result.scalar_one_or_none()

        if not processed:
            raise HTTPException(status_code=404, detail="No processed data found")

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Field", "Value"])
        writer.writerow(["Title", processed.title])
        writer.writerow(["Category", processed.category])
        writer.writerow(["Summary", processed.summary])
        writer.writerow(["Keywords", ", ".join(processed.keywords or [])])
        writer.writerow(["Raw Text", processed.raw_text])

        output.seek(0)

        return StreamingResponse(
            io.StringIO(output.getvalue()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=document_{id}.csv"
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/export/bulk")
async def export_bulk(format: str = Query(...), db: AsyncSession = Depends(get_db)):
    try:
        if format not in ["csv", "json"]:
            raise HTTPException(status_code=400, detail="Invalid format")

        result = await db.execute(
            select(ProcessedResult).where(ProcessedResult.is_finalized == True)
        )
        results = result.scalars().all()

        if not results:
            raise HTTPException(status_code=404, detail="No finalized documents found")

        # ---------------- CSV ----------------
        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)

            writer.writerow(["Title", "Category", "Summary", "Keywords"])

            for r in results:
                writer.writerow([
                    r.title,
                    r.category,
                    r.summary,
                    ", ".join(r.keywords or []),
                ])

            output.seek(0)

            return StreamingResponse(
                io.StringIO(output.getvalue()),
                media_type="text/csv",
                headers={
                    "Content-Disposition": "attachment; filename=bulk_export.csv"
                },
            )

        # ---------------- JSON ----------------
        data = [
            {
                "title": r.title,
                "category": r.category,
                "summary": r.summary,
                "keywords": r.keywords,
            }
            for r in results
        ]

        json_bytes = json.dumps(data, indent=2).encode("utf-8")

        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={
                "Content-Disposition": "attachment; filename=bulk_export.json"
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------
# DELETE (DB + FILE)
# -------------------------------
@router.delete("/{id}")
async def delete_document(id: str, db: AsyncSession = Depends(get_db)):
    try:
        job_id = uuid.UUID(id)

        result = await db.execute(
            select(DocumentJob).where(DocumentJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Document not found")

        # delete processed result
        result_obj = await db.execute(
            select(ProcessedResult).where(ProcessedResult.job_id == job_id)
        )
        processed = result_obj.scalar_one_or_none()

        if processed:
            await db.delete(processed)

        # 🔥 FIX FILE DELETE PATH
        file_path = job.file_path
        if not os.path.isabs(file_path):
            file_path = os.path.join("/app", file_path.lstrip("./"))

        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"File delete failed: {e}")
        else:
            print(f"File not found: {file_path}")

        # delete job
        await db.delete(job)
        await db.commit()

        return {"message": "Deleted successfully"}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))