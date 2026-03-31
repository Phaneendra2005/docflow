# DocFlow — Async Document Processing Workflow System

## Overview

DocFlow is a full-stack async document processing workflow system. Users upload one or more documents, the backend stores jobs and files in PostgreSQL + local filesystem storage, background workers process documents via Celery, progress streams in real time using Redis Pub/Sub and Server-Sent Events (SSE), and users can review, edit, finalize, and export results as JSON or CSV.

## Architecture Overview

Text-based flow diagram:

```text
Upload
  ↓
FastAPI (POST /api/documents/upload)
  ↓
Save file + create DocumentJob in PostgreSQL
  ↓
Enqueue Celery task (process_document)
  ↓
Redis broker + worker execution
  ↓
Worker publishes progress events to Redis Pub/Sub:
  "job_progress:{job_id}"
  ↓
FastAPI SSE endpoint streams events to frontend:
  GET /api/documents/{jobId}/progress
  ↓
Worker saves ProcessedResult to PostgreSQL
  ↓
User edits/finalizes result
  ↓
Export JSON / CSV
```

## Tech Stack

- Next.js 14 + TypeScript (App Router): fast UI development and server-friendly routing patterns.
- FastAPI (Python): strongly typed request/response validation and async web handling.
- PostgreSQL + SQLAlchemy (async): robust relational storage for jobs and processed results.
- Alembic: schema migrations and versioned database changes.
- Celery + Redis broker: dependable background processing and job execution.
- Redis Pub/Sub: lightweight progress signaling between workers and the API layer.
- SSE: simple, robust real-time progress streaming without WebSocket complexity.

## Setup Instructions (Local Dev without Docker)

1. Clone repo
2. Start PostgreSQL and Redis locally
3. Backend setup
   1. Create and activate a virtualenv
   2. Install dependencies:
      - `pip install -r backend/requirements.txt`
   3. Set environment variables:
      - `cp .env.example .env`
   4. Run migrations:
      - `cd backend`
      - `alembic upgrade head`
   5. Start API:
      - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Worker setup
   - `celery -A app.worker.celery_app worker --loglevel=info`
5. Frontend setup
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Setup Instructions (Docker Compose)

1. `cp .env.example .env`
2. `docker-compose up --build`
3. Run migrations inside container:
   - `docker-compose exec backend sh -lc "cd /app && alembic upgrade head"`

## API Endpoints Reference

| Method | Path | Description |
|---|---|---|
| POST | `/api/documents/upload` | Upload one or more files; returns created jobs |
| GET | `/api/documents` | List jobs with filters + pagination |
| GET | `/api/documents/{id}` | Get full job detail including processed result |
| GET | `/api/documents/{id}/progress` | SSE stream of progress events |
| POST | `/api/documents/{id}/retry` | Retry a failed job |
| PUT | `/api/documents/{id}/result` | Update user-edits for extracted fields |
| POST | `/api/documents/{id}/finalize` | Finalize processed result |
| GET | `/api/documents/{id}/export` | Export single document (`format=json` or `csv`) |
| GET | `/api/documents/export/bulk` | Export all finalized documents (`format=csv`) |
| DELETE | `/api/documents/{id}` | Delete document and job |

## Processing Stages

Stages and progress percentages:

1. `job_started` — `0%`
2. `document_parsing_started` — `10%`
3. `document_parsing_completed` — `35%`
4. `field_extraction_started` — `40%`
5. `field_extraction_completed` — `75%`
6. `job_completed` — `100%`

On failure:
- `job_failed` is emitted and job status becomes `failed`.

## Assumptions

- Processing logic is simulated but architecture is real.
- Files are stored on the local filesystem (configurable via `UPLOAD_DIR`).
- No authentication is implemented (bonus items mentioned in prompt).

## Tradeoffs

- SSE chosen over WebSocket for simplicity and broad compatibility.
- Celery tasks run as background workers; async work in tasks is simulated using CPU/IO blocking calls for portability.
- Local file storage is used rather than S3 to keep deployment simple.

## Limitations

- No file deduplication.
- No user authentication.
- Single worker instance in dev.

## AI Tools Used

None.

