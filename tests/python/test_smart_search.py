"""
Tests unitaires pour ai_service/services/smart_search.py.

Stratégie : mock de call_llm_json pour tester le service en isolation.
On vérifie :
- La construction correcte des filtres de retour
- L'injection de la date du jour dans le prompt
- La propagation des LLMError
- La préservation de la query originale dans la réponse
"""
from __future__ import annotations

import asyncio
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from ai_service.models.schemas import (
    SearchFilters,
    SmartSearchRequest,
    SmartSearchResponse,
    TaskPriority,
    TaskStatus,
)
from ai_service.providers.openai_provider import LLMError


def run(coro):
    return asyncio.run(coro)


def make_filters(**kwargs) -> SearchFilters:
    return SearchFilters(**kwargs)


# ─── parse_search_query ───────────────────────────────────────────────────────

class TestParseSearchQuery:
    def test_returns_smart_search_response(self):
        mock_filters = make_filters(interpretation="High priority todo tasks")
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(return_value=mock_filters),
        ):
            from ai_service.services.smart_search import parse_search_query

            result = run(parse_search_query(SmartSearchRequest(query="urgent tasks")))

        assert isinstance(result, SmartSearchResponse)

    def test_original_query_is_preserved(self):
        """La query originale doit être stockée dans la réponse sans modification."""
        mock_filters = make_filters()
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(return_value=mock_filters),
        ):
            from ai_service.services.smart_search import parse_search_query

            result = run(parse_search_query(SmartSearchRequest(query="tasks due this week")))

        assert result.original_query == "tasks due this week"

    def test_filters_are_passed_through(self):
        """Les filtres retournés par le LLM doivent être inclus dans la réponse."""
        mock_filters = make_filters(
            status=TaskStatus.todo,
            priority=TaskPriority.high,
            keywords=["urgent", "bug"],
            interpretation="High priority todo tasks",
        )
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(return_value=mock_filters),
        ):
            from ai_service.services.smart_search import parse_search_query

            result = run(parse_search_query(SmartSearchRequest(query="urgent bugs")))

        assert result.filters.status == TaskStatus.todo
        assert result.filters.priority == TaskPriority.high
        assert "urgent" in result.filters.keywords

    def test_user_prompt_contains_todays_date(self):
        """La date du jour doit être injectée pour résoudre les dates relatives."""
        mock_llm = AsyncMock(return_value=make_filters())
        with patch("ai_service.services.smart_search.call_llm_json", new=mock_llm):
            from ai_service.services.smart_search import parse_search_query

            run(parse_search_query(SmartSearchRequest(query="due next week")))

        _, kwargs = mock_llm.call_args
        assert date.today().isoformat() in kwargs["user_prompt"]

    def test_user_prompt_contains_original_query(self):
        """La query de l'utilisateur doit apparaître dans le prompt envoyé au LLM."""
        mock_llm = AsyncMock(return_value=make_filters())
        with patch("ai_service.services.smart_search.call_llm_json", new=mock_llm):
            from ai_service.services.smart_search import parse_search_query

            run(parse_search_query(SmartSearchRequest(query="overdue high priority")))

        _, kwargs = mock_llm.call_args
        assert "overdue high priority" in kwargs["user_prompt"]

    def test_propagates_llm_timeout_error(self):
        """Une LLMError(504) doit remonter sans être modifiée."""
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(side_effect=LLMError("Timeout", status_code=504)),
        ):
            from ai_service.services.smart_search import parse_search_query

            with pytest.raises(LLMError) as exc_info:
                run(parse_search_query(SmartSearchRequest(query="test")))

        assert exc_info.value.status_code == 504

    def test_propagates_llm_api_error(self):
        """Une LLMError(502) doit remonter sans être modifiée."""
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(side_effect=LLMError("API error", status_code=502)),
        ):
            from ai_service.services.smart_search import parse_search_query

            with pytest.raises(LLMError):
                run(parse_search_query(SmartSearchRequest(query="test")))

    def test_called_with_low_temperature(self):
        """Smart search doit utiliser temperature=0.1 pour la cohérence des filtres."""
        mock_llm = AsyncMock(return_value=make_filters())
        with patch("ai_service.services.smart_search.call_llm_json", new=mock_llm):
            from ai_service.services.smart_search import parse_search_query

            run(parse_search_query(SmartSearchRequest(query="test")))

        _, kwargs = mock_llm.call_args
        assert kwargs["temperature"] == pytest.approx(0.1)

    def test_returns_null_filters_when_llm_finds_nothing(self):
        """Si le LLM retourne des filtres vides, la réponse doit les refléter."""
        mock_filters = make_filters()  # tous à None / []
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(return_value=mock_filters),
        ):
            from ai_service.services.smart_search import parse_search_query

            result = run(parse_search_query(SmartSearchRequest(query="anything")))

        assert result.filters.status is None
        assert result.filters.priority is None
        assert result.filters.keywords == []

    def test_due_date_filters_preserved(self):
        """Les contraintes de date (due_before, due_after) doivent être transmises."""
        mock_filters = make_filters(
            due_before="2026-04-07",
            due_after="2026-04-01",
            interpretation="Tasks due this week",
        )
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(return_value=mock_filters),
        ):
            from ai_service.services.smart_search import parse_search_query

            result = run(parse_search_query(SmartSearchRequest(query="due this week")))

        assert result.filters.due_before == "2026-04-07"
        assert result.filters.due_after == "2026-04-01"

    def test_interpretation_is_included(self):
        """L'interprétation humaine du LLM doit être incluse dans les filtres."""
        mock_filters = make_filters(interpretation="Completed tasks")
        with patch(
            "ai_service.services.smart_search.call_llm_json",
            new=AsyncMock(return_value=mock_filters),
        ):
            from ai_service.services.smart_search import parse_search_query

            result = run(parse_search_query(SmartSearchRequest(query="done")))

        assert result.filters.interpretation == "Completed tasks"
