"""
Vercel Python Serverless Function — AI entry point.

Toutes les requêtes /api/ai/* sont routées ici via vercel.json.
FastAPI gère le routing interne.
"""
from __future__ import annotations

import logging
import os
import sys

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from fastapi import FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader

from ai_service.core.config import settings
from ai_service.models.schemas import (
    TaskAssistantRequest,
    TaskAssistantResponse,
    SmartSearchRequest,
    SmartSearchResponse,
    DashboardSummaryRequest,
    DashboardSummaryResponse,
)
from ai_service.providers.openai_provider import LLMError
from ai_service.services.task_assistant import extract_tasks
from ai_service.services.smart_search import parse_search_query
from ai_service.services.dashboard_summary import generate_dashboard_summary

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

app = FastAPI(
    title="Task AI",
    docs_url="/api/ai/docs" if os.getenv("VERCEL_ENV") != "production" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

_key_header = APIKeyHeader(name="X-AI-Secret-Key", auto_error=False)


async def _check_secret(key: str | None = Security(_key_header)) -> None:
    if settings.ai_secret_key and key != settings.ai_secret_key:
        raise HTTPException(status_code=401, detail="Missing or invalid X-AI-Secret-Key header.")


def _llm_error(exc: LLMError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc))


@app.get("/api/ai/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/ai/task-assistant",
    response_model=TaskAssistantResponse,
    dependencies=[Security(_check_secret)],
)
async def task_assistant(request: TaskAssistantRequest) -> TaskAssistantResponse:
    """Transforme du texte libre en liste de tâches structurées."""
    try:
        return await extract_tasks(request)
    except LLMError as exc:
        _llm_error(exc)


@app.post(
    "/api/ai/smart-search",
    response_model=SmartSearchResponse,
    dependencies=[Security(_check_secret)],
)
async def smart_search(request: SmartSearchRequest) -> SmartSearchResponse:
    """Convertit une requête naturelle en filtres structurés pour /api/tasks."""
    try:
        return await parse_search_query(request)
    except LLMError as exc:
        _llm_error(exc)


@app.post(
    "/api/ai/dashboard-summary",
    response_model=DashboardSummaryResponse,
    dependencies=[Security(_check_secret)],
)
async def dashboard_summary(request: DashboardSummaryRequest) -> DashboardSummaryResponse:
    """Génère un résumé actionnable : priorités, urgences, suggestions."""
    try:
        return await generate_dashboard_summary(request)
    except LLMError as exc:
        _llm_error(exc)
