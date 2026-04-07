"""
Vercel Python Serverless Function — AI entry point.

Ce fichier est le seul point d'entrée Python pour Vercel.
Vercel détecte `app` comme une ASGI app (FastAPI) et la sert directement.

Toutes les requêtes /api/ai/* sont redirigées ici via vercel.json :
  { "rewrites": [{ "source": "/api/ai/:path*", "destination": "/api/ai" }] }

FastAPI gère ensuite le routing interne par préfixe /api/ai/*.

Structure :
- Aucune logique métier ici
- Chaque route délègue à un service dans ai_service/services/
- LLMError → HTTPException avec le status_code approprié
"""
from __future__ import annotations

import logging
import os
import sys

# Assure que ai_service/ est importable depuis n'importe quel répertoire de travail.
# Vercel exécute la fonction depuis la racine du projet, mais on sécurise l'import.
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from fastapi import FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader

from ai_service.core.config import settings
from ai_service.models.schemas import (
    DashboardSummaryRequest,
    DashboardSummaryResponse,
    SmartSearchRequest,
    SmartSearchResponse,
    TaskAssistantRequest,
    TaskAssistantResponse,
)
from ai_service.providers.openai_provider import LLMError
from ai_service.services.dashboard_summary import generate_dashboard_summary
from ai_service.services.smart_search import parse_search_query
from ai_service.services.task_assistant import extract_tasks

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

app = FastAPI(
    title="Task AI — V1",
    # Désactive les docs en production (pas utile sur Vercel serverless)
    docs_url="/api/ai/docs" if os.getenv("VERCEL_ENV") != "production" else None,
    redoc_url=None,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Autorise uniquement les origines connues. En production, remplacer * par le domaine Vercel.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restreindre à votre domaine Vercel en prod
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ─── Auth optionnel par secret header ─────────────────────────────────────────
# Si AI_SECRET_KEY est défini dans les env vars Vercel, chaque requête doit
# inclure X-AI-Secret-Key: <valeur>. Utilisé pour protéger l'API IA
# des appels non autorisés sans implémenter un vrai système d'auth.

_key_header = APIKeyHeader(name="X-AI-Secret-Key", auto_error=False)


async def _check_secret(key: str | None = Security(_key_header)) -> None:
    if settings.ai_secret_key and key != settings.ai_secret_key:
        raise HTTPException(status_code=401, detail="Missing or invalid X-AI-Secret-Key header.")


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/ai/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ─── Task Assistant ───────────────────────────────────────────────────────────

@app.post(
    "/api/ai/task-assistant",
    response_model=TaskAssistantResponse,
    status_code=200,
    dependencies=[Security(_check_secret)],
)
async def task_assistant(request: TaskAssistantRequest) -> TaskAssistantResponse:
    """
    Transforme un texte libre en liste de tâches structurées.

    Input  : { "text": "texte libre de l'utilisateur" }
    Output : { "tasks": [...], "raw_text": "..." }
    """
    try:
        return await extract_tasks(request)
    except LLMError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


# ─── Smart Search ─────────────────────────────────────────────────────────────

@app.post(
    "/api/ai/smart-search",
    response_model=SmartSearchResponse,
    status_code=200,
    dependencies=[Security(_check_secret)],
)
async def smart_search(request: SmartSearchRequest) -> SmartSearchResponse:
    """
    Convertit une requête en langage naturel en filtres de recherche structurés.

    Input  : { "query": "tasks due this week" }
    Output : { "filters": { "status": null, "priority": null, "keywords": [], ... }, "original_query": "..." }
    """
    try:
        return await parse_search_query(request)
    except LLMError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


# ─── Dashboard Summary ────────────────────────────────────────────────────────

@app.post(
    "/api/ai/dashboard-summary",
    response_model=DashboardSummaryResponse,
    status_code=200,
    dependencies=[Security(_check_secret)],
)
async def dashboard_summary(request: DashboardSummaryRequest) -> DashboardSummaryResponse:
    """
    Génère un résumé IA du tableau de bord à partir des tâches de l'utilisateur.

    Input  : { "tasks": [...], "stats": { "total": ..., "todo": ..., ... } }
    Output : { "summary": "...", "top_priorities": [...], "suggested_actions": [...], "urgent_tasks": [...] }
    """
    try:
        return await generate_dashboard_summary(request)
    except LLMError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
