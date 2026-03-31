from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class DocumentJobCreate(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    file_type: str


class ProcessedResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    title: str
    category: str
    summary: str
    keywords: list[str]
    extracted_metadata: dict[str, Any]
    raw_text: str
    is_finalized: bool
    finalized_at: datetime | None
    user_edits: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class ProcessedResultUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    summary: str | None = None
    keywords: list[str] | None = None


class DocumentJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    file_type: str
    status: Literal["queued", "processing", "completed", "failed"]
    created_at: datetime
    updated_at: datetime
    celery_task_id: str | None = None
    error_message: str | None = None
    retry_count: int


class DocumentJobListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: Literal["queued", "processing", "completed", "failed"]
    created_at: datetime
    retry_count: int
    error_message: str | None = None


class JobStatusUpdate(BaseModel):
    status: Literal["queued", "processing", "completed", "failed"]


class ProgressEvent(BaseModel):
    job_id: UUID
    event_type: str
    message: str
    progress_percent: int
    timestamp: datetime


class ExportResponse(BaseModel):
    format: Literal["json", "csv"]
    filename: str
    content_type: str
    content: str


class ListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[DocumentJobListResponse]
    total: int
    queued_count: int
    processing_count: int
    completed_count: int
    failed_count: int
    finalized_count: int  # 🔥 ADD THIS
    skip: int
    limit: int

