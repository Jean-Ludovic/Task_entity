"""
Tests d'intégration pour les routes FastAPI (api/ai.py).

Stratégie : on utilise le TestClient de FastAPI (synchrone) et on mock
les services métier pour ne pas appeler de vrai LLM.

Couverture :
- GET  /api/ai/health
- POST /api/ai/task-assistant  — 200, 422, 502, 504
- POST /api/ai/smart-search    — 200, 422, 502
- POST /api/ai/dashboard-summary — 200, 422, 502
- Authentification par X-AI-Secret-Key (quand AI_SECRET_KEY est défini)
"""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest

from ai_service.models.schemas import (
    DashboardSummaryResponse,
    ExtractedTask,
    SearchFilters,
    SmartSearchResponse,
    SuggestedAction,
    TaskAssistantResponse,
)
from ai_service.providers.openai_provider import LLMError


# ─── Fixtures ─────────────────────────────────────────────────────────────────

# Note : le client est défini dans conftest.py (session-scoped).


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_task_response(titles: list[str] = None) -> TaskAssistantResponse:
    titles = titles or ["Write tests"]
    return TaskAssistantResponse(
        tasks=[ExtractedTask(title=t) for t in titles],
        raw_text="mocked input",
    )


def make_search_response(interpretation: str = "Todo tasks") -> SmartSearchResponse:
    return SmartSearchResponse(
        filters=SearchFilters(interpretation=interpretation),
        original_query="mocked query",
    )


def make_summary_response() -> DashboardSummaryResponse:
    return DashboardSummaryResponse(
        summary="You have tasks.",
        top_priorities=["Fix login"],
        suggested_actions=[SuggestedAction(action="Start now", reason="It's urgent")],
        urgent_tasks=["Fix login"],
    )


# ─── GET /api/ai/health ────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_returns_200_ok(self, client):
        res = client.get("/api/ai/health")
        assert res.status_code == 200

    def test_returns_status_ok(self, client):
        res = client.get("/api/ai/health")
        assert res.json() == {"status": "ok"}


# ─── POST /api/ai/task-assistant ──────────────────────────────────────────────

class TestTaskAssistantRoute:
    def test_returns_200_with_extracted_tasks(self, client):
        mock_result = make_task_response(["Write docs", "Fix bug"])
        with patch(
            "api.ai.extract_tasks",
            new=AsyncMock(return_value=mock_result),
        ):
            res = client.post("/api/ai/task-assistant", json={"text": "Write docs and fix bug"})

        assert res.status_code == 200
        body = res.json()
        assert "tasks" in body
        assert len(body["tasks"]) == 2

    def test_tasks_have_expected_fields(self, client):
        mock_result = make_task_response(["Deploy to prod"])
        with patch("api.ai.extract_tasks", new=AsyncMock(return_value=mock_result)):
            res = client.post("/api/ai/task-assistant", json={"text": "Deploy to prod ASAP"})

        task = res.json()["tasks"][0]
        assert "title" in task
        assert "status" in task
        assert "priority" in task

    def test_raw_text_is_in_response(self, client):
        mock_result = make_task_response()
        with patch("api.ai.extract_tasks", new=AsyncMock(return_value=mock_result)):
            res = client.post("/api/ai/task-assistant", json={"text": "some text"})

        assert "raw_text" in res.json()

    def test_returns_422_when_text_is_missing(self, client):
        """FastAPI doit rejeter la requête si le champ 'text' est absent."""
        res = client.post("/api/ai/task-assistant", json={})
        assert res.status_code == 422

    def test_returns_422_when_text_is_too_short(self, client):
        """Pydantic doit rejeter un texte de moins de 3 caractères."""
        res = client.post("/api/ai/task-assistant", json={"text": "ab"})
        assert res.status_code == 422

    def test_returns_422_when_body_is_not_json(self, client):
        """Un body non-JSON doit retourner 422."""
        res = client.post(
            "/api/ai/task-assistant",
            content="not json",
            headers={"Content-Type": "application/json"},
        )
        assert res.status_code == 422

    def test_returns_502_when_llm_api_error(self, client):
        """Une LLMError(502) doit être transformée en HTTP 502."""
        with patch(
            "api.ai.extract_tasks",
            new=AsyncMock(side_effect=LLMError("API error", status_code=502)),
        ):
            res = client.post("/api/ai/task-assistant", json={"text": "test"})

        assert res.status_code == 502

    def test_returns_504_when_llm_timeout(self, client):
        """Une LLMError(504) doit être transformée en HTTP 504."""
        with patch(
            "api.ai.extract_tasks",
            new=AsyncMock(side_effect=LLMError("Timeout", status_code=504)),
        ):
            res = client.post("/api/ai/task-assistant", json={"text": "test"})

        assert res.status_code == 504

    def test_error_response_has_detail_field(self, client):
        """Le body d'erreur FastAPI doit contenir un champ 'detail'."""
        with patch(
            "api.ai.extract_tasks",
            new=AsyncMock(side_effect=LLMError("Bad gateway", status_code=502)),
        ):
            res = client.post("/api/ai/task-assistant", json={"text": "test"})

        assert "detail" in res.json()

    def test_returns_empty_task_list_when_llm_finds_nothing(self, client):
        """Un texte sans tâches actionables doit retourner tasks: []."""
        mock_result = TaskAssistantResponse(tasks=[], raw_text="hello world")
        with patch("api.ai.extract_tasks", new=AsyncMock(return_value=mock_result)):
            res = client.post("/api/ai/task-assistant", json={"text": "hello world"})

        assert res.status_code == 200
        assert res.json()["tasks"] == []


# ─── POST /api/ai/smart-search ────────────────────────────────────────────────

class TestSmartSearchRoute:
    def test_returns_200_with_filters(self, client):
        mock_result = make_search_response("High priority tasks due this week")
        with patch(
            "api.ai.parse_search_query",
            new=AsyncMock(return_value=mock_result),
        ):
            res = client.post("/api/ai/smart-search", json={"query": "urgent tasks this week"})

        assert res.status_code == 200
        body = res.json()
        assert "filters" in body
        assert "original_query" in body

    def test_filters_have_expected_fields(self, client):
        mock_result = make_search_response()
        with patch("api.ai.parse_search_query", new=AsyncMock(return_value=mock_result)):
            res = client.post("/api/ai/smart-search", json={"query": "done tasks"})

        filters = res.json()["filters"]
        assert "status" in filters
        assert "priority" in filters
        assert "keywords" in filters
        assert "due_before" in filters
        assert "due_after" in filters
        assert "interpretation" in filters

    def test_original_query_is_echoed(self, client):
        mock_result = make_search_response()
        mock_result.original_query = "done tasks"
        with patch("api.ai.parse_search_query", new=AsyncMock(return_value=mock_result)):
            res = client.post("/api/ai/smart-search", json={"query": "done tasks"})

        assert res.json()["original_query"] == "done tasks"

    def test_returns_422_when_query_is_missing(self, client):
        res = client.post("/api/ai/smart-search", json={})
        assert res.status_code == 422

    def test_returns_422_when_query_is_empty(self, client):
        res = client.post("/api/ai/smart-search", json={"query": ""})
        assert res.status_code == 422

    def test_returns_502_on_llm_error(self, client):
        with patch(
            "api.ai.parse_search_query",
            new=AsyncMock(side_effect=LLMError("Error", status_code=502)),
        ):
            res = client.post("/api/ai/smart-search", json={"query": "test"})

        assert res.status_code == 502

    def test_returns_504_on_llm_timeout(self, client):
        with patch(
            "api.ai.parse_search_query",
            new=AsyncMock(side_effect=LLMError("Timeout", status_code=504)),
        ):
            res = client.post("/api/ai/smart-search", json={"query": "test"})

        assert res.status_code == 504


# ─── POST /api/ai/dashboard-summary ──────────────────────────────────────────

class TestDashboardSummaryRoute:
    VALID_PAYLOAD = {
        "tasks": [
            {
                "id": "t1",
                "title": "Fix auth",
                "status": "todo",
                "priority": "high",
                "due_date": None,
                "is_overdue": False,
            }
        ],
        "stats": {
            "total": 1,
            "todo": 1,
            "in_progress": 0,
            "done": 0,
            "overdue": 0,
            "high_priority": 1,
        },
    }

    def test_returns_200_with_summary(self, client):
        mock_result = make_summary_response()
        with patch(
            "api.ai.generate_dashboard_summary",
            new=AsyncMock(return_value=mock_result),
        ):
            res = client.post("/api/ai/dashboard-summary", json=self.VALID_PAYLOAD)

        assert res.status_code == 200
        body = res.json()
        assert "summary" in body
        assert "top_priorities" in body
        assert "suggested_actions" in body
        assert "urgent_tasks" in body

    def test_summary_content_is_returned(self, client):
        mock_result = make_summary_response()
        mock_result.summary = "You have 1 high priority task."
        with patch(
            "api.ai.generate_dashboard_summary",
            new=AsyncMock(return_value=mock_result),
        ):
            res = client.post("/api/ai/dashboard-summary", json=self.VALID_PAYLOAD)

        assert res.json()["summary"] == "You have 1 high priority task."

    def test_accepts_empty_task_list(self, client):
        payload = {"tasks": [], "stats": {"total": 0, "todo": 0, "in_progress": 0,
                                           "done": 0, "overdue": 0, "high_priority": 0}}
        mock_result = make_summary_response()
        with patch(
            "api.ai.generate_dashboard_summary",
            new=AsyncMock(return_value=mock_result),
        ):
            res = client.post("/api/ai/dashboard-summary", json=payload)

        assert res.status_code == 200

    def test_returns_422_when_stats_missing(self, client):
        res = client.post("/api/ai/dashboard-summary", json={"tasks": []})
        assert res.status_code == 422

    def test_returns_422_when_tasks_missing(self, client):
        res = client.post("/api/ai/dashboard-summary", json={
            "stats": {"total": 0, "todo": 0, "in_progress": 0, "done": 0, "overdue": 0, "high_priority": 0}
        })
        assert res.status_code == 422

    def test_returns_502_on_llm_error(self, client):
        with patch(
            "api.ai.generate_dashboard_summary",
            new=AsyncMock(side_effect=LLMError("Error", status_code=502)),
        ):
            res = client.post("/api/ai/dashboard-summary", json=self.VALID_PAYLOAD)

        assert res.status_code == 502

    def test_returns_504_on_llm_timeout(self, client):
        with patch(
            "api.ai.generate_dashboard_summary",
            new=AsyncMock(side_effect=LLMError("Timeout", status_code=504)),
        ):
            res = client.post("/api/ai/dashboard-summary", json=self.VALID_PAYLOAD)

        assert res.status_code == 504

    def test_suggested_actions_have_action_and_reason(self, client):
        mock_result = make_summary_response()
        with patch(
            "api.ai.generate_dashboard_summary",
            new=AsyncMock(return_value=mock_result),
        ):
            res = client.post("/api/ai/dashboard-summary", json=self.VALID_PAYLOAD)

        action = res.json()["suggested_actions"][0]
        assert "action" in action
        assert "reason" in action


# ─── Authentification par secret ──────────────────────────────────────────────

class TestSecretKeyAuth:
    """
    Vérifie le comportement de l'authentification par X-AI-Secret-Key.
    Ces tests modifient le settings.ai_secret_key de manière contextuelle.
    """

    def test_rejects_request_when_secret_is_wrong(self, client):
        from ai_service.core.config import settings

        original = settings.ai_secret_key
        settings.ai_secret_key = "correct-secret"
        try:
            res = client.post(
                "/api/ai/task-assistant",
                json={"text": "test"},
                headers={"X-AI-Secret-Key": "wrong-secret"},
            )
            assert res.status_code == 401
        finally:
            settings.ai_secret_key = original

    def test_accepts_request_when_secret_is_correct(self, client):
        from ai_service.core.config import settings

        original = settings.ai_secret_key
        settings.ai_secret_key = "correct-secret"
        try:
            mock_result = make_task_response()
            with patch("api.ai.extract_tasks", new=AsyncMock(return_value=mock_result)):
                res = client.post(
                    "/api/ai/task-assistant",
                    json={"text": "test task"},
                    headers={"X-AI-Secret-Key": "correct-secret"},
                )
            assert res.status_code == 200
        finally:
            settings.ai_secret_key = original

    def test_allows_request_when_no_secret_configured(self, client):
        """Si AI_SECRET_KEY est vide, aucune clé n'est requise."""
        from ai_service.core.config import settings

        original = settings.ai_secret_key
        settings.ai_secret_key = ""
        try:
            mock_result = make_task_response()
            with patch("api.ai.extract_tasks", new=AsyncMock(return_value=mock_result)):
                # Aucun header X-AI-Secret-Key envoyé
                res = client.post("/api/ai/task-assistant", json={"text": "test task"})
            assert res.status_code == 200
        finally:
            settings.ai_secret_key = original
