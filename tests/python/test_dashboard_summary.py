"""
Tests unitaires pour ai_service/services/dashboard_summary.py.

Stratégie : mock de call_llm_json pour isoler le service.
On vérifie :
- La structure de la réponse retournée
- Le formatage des données en input du LLM (_format_tasks)
- L'injection de la date du jour
- La propagation des LLMError
- La gestion des tâches urgentes (overdue, high_priority)
"""
from __future__ import annotations

import asyncio
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from ai_service.models.schemas import (
    DashboardSummaryRequest,
    DashboardSummaryResponse,
    SuggestedAction,
    TaskInput,
    TaskStat,
)
from ai_service.providers.openai_provider import LLMError


def run(coro):
    return asyncio.run(coro)


def make_response(**kwargs) -> DashboardSummaryResponse:
    defaults = dict(
        summary="You have tasks to complete.",
        top_priorities=["Fix login bug"],
        suggested_actions=[SuggestedAction(action="Start ASAP", reason="It's overdue")],
        urgent_tasks=["Fix login bug"],
    )
    return DashboardSummaryResponse(**{**defaults, **kwargs})


def make_request(tasks=None, **stat_kwargs) -> DashboardSummaryRequest:
    return DashboardSummaryRequest(
        tasks=tasks or [],
        stats=TaskStat(**stat_kwargs),
    )


# ─── generate_dashboard_summary ──────────────────────────────────────────────

class TestGenerateDashboardSummary:
    def test_returns_dashboard_summary_response(self):
        mock_result = make_response()
        with patch(
            "ai_service.services.dashboard_summary.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            result = run(generate_dashboard_summary(make_request(total=1)))

        assert isinstance(result, DashboardSummaryResponse)

    def test_summary_is_present(self):
        mock_result = make_response(summary="5 tasks open, 2 overdue.")
        with patch(
            "ai_service.services.dashboard_summary.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            result = run(generate_dashboard_summary(make_request()))

        assert result.summary == "5 tasks open, 2 overdue."

    def test_top_priorities_are_returned(self):
        mock_result = make_response(top_priorities=["Fix auth", "Write docs", "Deploy"])
        with patch(
            "ai_service.services.dashboard_summary.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            result = run(generate_dashboard_summary(make_request()))

        assert result.top_priorities == ["Fix auth", "Write docs", "Deploy"]

    def test_suggested_actions_are_returned(self):
        actions = [
            SuggestedAction(action="Review PRs", reason="2 are stale"),
            SuggestedAction(action="Fix login", reason="Blocks users"),
        ]
        mock_result = make_response(suggested_actions=actions)
        with patch(
            "ai_service.services.dashboard_summary.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            result = run(generate_dashboard_summary(make_request()))

        assert len(result.suggested_actions) == 2
        assert result.suggested_actions[0].action == "Review PRs"

    def test_urgent_tasks_are_returned(self):
        mock_result = make_response(urgent_tasks=["Deploy hotfix", "Fix login"])
        with patch(
            "ai_service.services.dashboard_summary.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            result = run(generate_dashboard_summary(make_request()))

        assert "Deploy hotfix" in result.urgent_tasks

    def test_propagates_llm_error(self):
        with patch(
            "ai_service.services.dashboard_summary.call_llm_json",
            new=AsyncMock(side_effect=LLMError("Timeout", status_code=504)),
        ):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            with pytest.raises(LLMError) as exc_info:
                run(generate_dashboard_summary(make_request()))

        assert exc_info.value.status_code == 504

    def test_user_prompt_contains_todays_date(self):
        mock_llm = AsyncMock(return_value=make_response())
        with patch("ai_service.services.dashboard_summary.call_llm_json", new=mock_llm):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            run(generate_dashboard_summary(make_request()))

        _, kwargs = mock_llm.call_args
        assert date.today().isoformat() in kwargs["user_prompt"]

    def test_user_prompt_contains_stats(self):
        """Les statistiques (total, overdue…) doivent apparaître dans le prompt."""
        mock_llm = AsyncMock(return_value=make_response())
        with patch("ai_service.services.dashboard_summary.call_llm_json", new=mock_llm):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            run(generate_dashboard_summary(
                DashboardSummaryRequest(
                    tasks=[],
                    stats=TaskStat(total=7, todo=3, overdue=2),
                )
            ))

        _, kwargs = mock_llm.call_args
        prompt: str = kwargs["user_prompt"]
        assert "7" in prompt   # total
        assert "2" in prompt   # overdue

    def test_user_prompt_contains_task_titles(self):
        """Les titres de tâches doivent être visibles dans le prompt."""
        tasks = [
            TaskInput(id="t1", title="Deploy v2.0", status="todo", priority="high"),
            TaskInput(id="t2", title="Fix auth bug", status="in_progress"),
        ]
        mock_llm = AsyncMock(return_value=make_response())
        with patch("ai_service.services.dashboard_summary.call_llm_json", new=mock_llm):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            run(generate_dashboard_summary(
                DashboardSummaryRequest(tasks=tasks, stats=TaskStat(total=2))
            ))

        _, kwargs = mock_llm.call_args
        assert "Deploy v2.0" in kwargs["user_prompt"]
        assert "Fix auth bug" in kwargs["user_prompt"]

    def test_overdue_flag_appears_in_prompt(self):
        """Les tâches marquées overdue doivent avoir un flag OVERDUE dans le prompt."""
        tasks = [
            TaskInput(id="t1", title="Late task", status="todo", is_overdue=True)
        ]
        mock_llm = AsyncMock(return_value=make_response())
        with patch("ai_service.services.dashboard_summary.call_llm_json", new=mock_llm):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            run(generate_dashboard_summary(
                DashboardSummaryRequest(tasks=tasks, stats=TaskStat(total=1, overdue=1))
            ))

        _, kwargs = mock_llm.call_args
        assert "OVERDUE" in kwargs["user_prompt"]

    def test_high_priority_flag_appears_in_prompt(self):
        """Les tâches high priority non terminées doivent avoir un flag HIGH_PRIORITY."""
        tasks = [
            TaskInput(id="t1", title="Critical deploy", status="todo", priority="high")
        ]
        mock_llm = AsyncMock(return_value=make_response())
        with patch("ai_service.services.dashboard_summary.call_llm_json", new=mock_llm):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            run(generate_dashboard_summary(
                DashboardSummaryRequest(tasks=tasks, stats=TaskStat(total=1, high_priority=1))
            ))

        _, kwargs = mock_llm.call_args
        assert "HIGH_PRIORITY" in kwargs["user_prompt"]

    def test_limits_tasks_to_30_in_prompt(self):
        """Le prompt ne doit pas dépasser 30 tâches pour éviter les prompts trop longs."""
        tasks = [
            TaskInput(id=f"t{i}", title=f"Task {i}", status="todo")
            for i in range(50)
        ]
        mock_llm = AsyncMock(return_value=make_response())
        with patch("ai_service.services.dashboard_summary.call_llm_json", new=mock_llm):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            run(generate_dashboard_summary(
                DashboardSummaryRequest(tasks=tasks, stats=TaskStat(total=50))
            ))

        _, kwargs = mock_llm.call_args
        prompt: str = kwargs["user_prompt"]
        # Task 30 doit être absent (index 30, titre "Task 30")
        # On compte les lignes de tâches (commencent par "- [")
        task_lines = [l for l in prompt.split("\n") if l.startswith("- [")]
        assert len(task_lines) <= 30

    def test_empty_task_list_does_not_crash(self):
        """Un utilisateur sans tâches doit obtenir une réponse, pas une erreur."""
        mock_result = make_response(summary="Nothing to do, great work!")
        with patch(
            "ai_service.services.dashboard_summary.call_llm_json",
            new=AsyncMock(return_value=mock_result),
        ):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            result = run(generate_dashboard_summary(make_request()))

        assert result.summary == "Nothing to do, great work!"

    def test_called_with_higher_temperature(self):
        """Dashboard summary utilise température > 0.1 pour des suggestions variées."""
        mock_llm = AsyncMock(return_value=make_response())
        with patch("ai_service.services.dashboard_summary.call_llm_json", new=mock_llm):
            from ai_service.services.dashboard_summary import generate_dashboard_summary

            run(generate_dashboard_summary(make_request()))

        _, kwargs = mock_llm.call_args
        # temperature doit être > 0.1 (permet la diversité des suggestions)
        assert kwargs["temperature"] > 0.1


# ─── _format_tasks (helper interne) ───────────────────────────────────────────

class TestFormatTasks:
    """Tests de la fonction de formatage interne, importée directement."""

    def test_includes_stats_line(self):
        from ai_service.services.dashboard_summary import _format_tasks

        req = DashboardSummaryRequest(
            tasks=[],
            stats=TaskStat(total=5, todo=2, in_progress=2, done=1, overdue=1, high_priority=2),
        )
        result = _format_tasks(req)
        assert "5 total" in result
        assert "1 overdue" in result

    def test_includes_task_title(self):
        from ai_service.services.dashboard_summary import _format_tasks

        req = DashboardSummaryRequest(
            tasks=[TaskInput(id="t1", title="Fix auth", status="todo")],
            stats=TaskStat(total=1),
        )
        result = _format_tasks(req)
        assert "Fix auth" in result

    def test_overdue_tasks_appear_first(self):
        """Les tâches overdue doivent apparaître en tête du prompt (tri prioritaire)."""
        from ai_service.services.dashboard_summary import _format_tasks

        tasks = [
            TaskInput(id="t1", title="Normal task", status="todo", is_overdue=False),
            TaskInput(id="t2", title="Overdue task", status="todo", is_overdue=True),
        ]
        req = DashboardSummaryRequest(tasks=tasks, stats=TaskStat(total=2))
        result = _format_tasks(req)

        idx_overdue = result.index("Overdue task")
        idx_normal = result.index("Normal task")
        assert idx_overdue < idx_normal

    def test_empty_tasks_outputs_no_tasks_message(self):
        from ai_service.services.dashboard_summary import _format_tasks

        req = DashboardSummaryRequest(tasks=[], stats=TaskStat())
        result = _format_tasks(req)
        assert "No tasks" in result
