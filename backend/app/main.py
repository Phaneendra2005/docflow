from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.documents import router as documents_router
from app.api.routes.jobs import router as jobs_router
from app.config import settings

from app.db.base import Base
from app.db.session import engine

import app.models 

def _parse_origins(raw: str) -> list[str]:
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="DocFlow", version="0.1.0")

allowed_origins = _parse_origins(settings.ALLOWED_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

