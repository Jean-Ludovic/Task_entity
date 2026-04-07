"""
Tests unitaires pour ai_service/services/task_assistant.py.

Stratégie : on mock call_llm_json pour ne pas appeler de vrai LLM.
On vérifie que le service :
- construit correctement le prompt
- délègue au provider
- retourne une TaskAssistantResponse validée
- propage les LLMError sans les modifier
"""
from __future__ import annotations

import asyncio
from datetime import date
from unittest.mock import AsyncMock, patch, call

import pytest

from ai_service.models.schemas import (
    ExtractedTask,
    TaskAssistantRequest,
    TaskAssistantResponse,
    TaskPriority,
    TaskStatus,
)
from ai_service.providers.openai_provider import LLMError


# ─── Helpers ──────────────────────────────────────────────────────────────────

def run(coro):
    """Exécute une coroutine synchronement (compatible Python 3.12 sans pytest-asyncio)."""
    return asyncio.run(coro)


def make_llm_result(tasks: list[dict]) -> TaskAssistantResponse:
    """Construit une TaskAssistantResponse pour simuler le retour du LLM."""
    return TaskAssistantResponse(
        tasks=[ExtractedTask(**t) for t in tasks],
        raw_text="mocked",
    )


# ─── extract_tasks ─────────────────────────────────────────────────────────────

class TestExtractTasks:
    def test_returns_response_with_tasks(self):
        mock_result = make_llm_result([
            {"title": "Write tests", "priority": "high", "status": "todo"}
        ])
        with patch(
            "ai_service.services.task_assistant.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.task_assistant import extract_tasks

            request = TaskAssistantRequest(text="Write tests asap")
            result = run(extract_tasks(request))

        assert isinstance(result, TaskAssistantResponse)
        assert len(result.tasks) == 1
        assert result.tasks[0].title == "Write tests"

    def test_raw_text_is_the_original_input(self):
        """Le raw_text de la réponse doit être le texte d'entrée, pas la réponse du LLM."""
        mock_result = make_llm_result([{"title": "T"}])
        with patch(
            "ai_service.services.task_assistant.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.task_assistant import extract_tasks

            request = TaskAssistantRequest(text="original user input")
            result = run(extract_tasks(request))

        assert result.raw_text == "original user input"

    def test_returns_empty_task_list_when_llm_finds_nothing(self):
        mock_result = make_llm_result([])
        with patch(
            "ai_service.services.task_assistant.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.task_assistant import extract_tasks

            result = run(extract_tasks(TaskAssistantRequest(text="hello world")))

        assert result.tasks == []

    def test_propagates_llm_error(self):
        """Une LLMError ne doit pas être avalée — elle doit remonter jusqu'à la route."""
        with patch(
            "ai_service.services.task_assistant.call_llm_json",
            new=AsyncMock(side_effect=LLMError("LLM timed out", status_code=504)),
        ):
            from ai_service.services.task_assistant import extract_tasks

            with pytest.raises(LLMError) as exc_info:
                run(extract_tasks(TaskAssistantRequest(text="fix the bug")))

        assert exc_info.value.status_code == 504

    def test_user_prompt_contains_todays_date(self):
        """Le prompt utilisateur doit injecter la date du jour pour les dates relatives."""
        mock_llm = AsyncMock(return_value=make_llm_result([]))
        with patch("ai_service.services.task_assistant.call_llm_json", new=mock_llm):
            from ai_service.services.task_assistant import extract_tasks

            run(extract_tasks(TaskAssistantRequest(text="do something tomorrow")))

        # Récupère le user_prompt passé au provider
        _, kwargs = mock_llm.call_args
        user_prompt: str = kwargs["user_prompt"]
        today = date.today().isoformat()
        assert today in user_prompt

    def test_user_prompt_contains_original_text(self):
        """Le texte original de l'utilisateur doit apparaître dans le prompt."""
        mock_llm = AsyncMock(return_value=make_llm_result([]))
        with patch("ai_service.services.task_assistant.call_llm_json", new=mock_llm):
            from ai_service.services.task_assistant import extract_tasks

            run(extract_tasks(TaskAssistantRequest(text="unique marker text XYZ")))

        _, kwargs = mock_llm.call_args
        assert "unique marker text XYZ" in kwargs["user_prompt"]

    def test_called_with_low_temperature(self):
        """Le service doit utiliser temperature=0.1 pour maximiser le déterminisme."""
        mock_llm = AsyncMock(return_value=make_llm_result([]))
        with patch("ai_service.services.task_assistant.call_llm_json", new=mock_llm):
            from ai_service.services.task_assistant import extract_tasks

            run(extract_tasks(TaskAssistantRequest(text="test temperature")))

        _, kwargs = mock_llm.call_args
        assert kwargs["temperature"] == pytest.approx(0.1)

    def test_returns_tasks_with_correct_fields(self):
        """Les champs des tâches extraites doivent correspondre aux valeurs du LLM."""
        mock_result = make_llm_result([
            {
                "title": "Deploy to production",
                "description": "Deploy v2 with no downtime",
                "status": "todo",
                "priority": "high",
                "due_date": "2026-06-01",
            }
        ])
        with patch(
            "ai_service.services.task_assistant.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.task_assistant import extract_tasks

            result = run(extract_tasks(TaskAssistantRequest(text="deploy by June")))

        task = result.tasks[0]
        assert task.title == "Deploy to production"
        assert task.priority == TaskPriority.high
        assert task.due_date == "2026-06-01"

    def test_handles_multiple_tasks(self):
        """Le service doit gérer l'extraction de plusieurs tâches simultanément."""
        tasks = [{"title": f"Task {i}"} for i in range(5)]
        with patch(
            "ai_service.services.task_assistant.call_llm_json",
            new=AsyncMock(return_value=make_llm_result(tasks)),
        ):
            from ai_service.services.task_assistant import extract_tasks

            result = run(extract_tasks(TaskAssistantRequest(text="many tasks")))

        assert len(result.tasks) == 5

    def test_llm_error_with_502_propagates(self):
        """LLMError(502) doit remonter avec le bon status_code."""
        with patch(
            "ai_service.services.task_assistant.call_llm_json",
            new=AsyncMock(side_effect=LLMError("Bad gateway", status_code=502)),
        ):
            from ai_service.services.task_assistant import extract_tasks

            with pytest.raises(LLMError) as exc_info:
                run(extract_tasks(TaskAssistantRequest(text="test 502")))

        assert exc_info.value.status_code == 502
