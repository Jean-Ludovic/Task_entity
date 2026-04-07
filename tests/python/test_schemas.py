"""
Tests unitaires pour les schémas Pydantic (ai_service/models/schemas.py).

Valide :
- La validation des champs obligatoires
- Les valeurs par défaut
- La normalisation (due_date)
- Le rejet des valeurs invalides
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from ai_service.models.schemas import (
    DashboardSummaryRequest,
    DashboardSummaryResponse,
    ExtractedTask,
    SearchFilters,
    SmartSearchRequest,
    SmartSearchResponse,
    SuggestedAction,
    TaskAssistantRequest,
    TaskAssistantResponse,
    TaskInput,
    TaskPriority,
    TaskStat,
    TaskStatus,
)


# ─── TaskAssistantRequest ──────────────────────────────────────────────────────

class TestTaskAssistantRequest:
    def test_accepts_valid_text(self):
        req = TaskAssistantRequest(text="Fix the login bug")
        assert req.text == "Fix the login bug"

    def test_rejects_text_too_short(self):
        with pytest.raises(ValidationError):
            TaskAssistantRequest(text="ab")  # min_length=3

    def test_rejects_empty_string(self):
        with pytest.raises(ValidationError):
            TaskAssistantRequest(text="")

    def test_rejects_text_too_long(self):
        with pytest.raises(ValidationError):
            TaskAssistantRequest(text="x" * 4001)  # max_length=4000

    def test_accepts_text_at_max_length(self):
        req = TaskAssistantRequest(text="x" * 4000)
        assert len(req.text) == 4000

    def test_accepts_text_at_min_length(self):
        req = TaskAssistantRequest(text="abc")
        assert req.text == "abc"


# ─── ExtractedTask ─────────────────────────────────────────────────────────────

class TestExtractedTask:
    def test_defaults_are_applied(self):
        task = ExtractedTask(title="Write report")
        assert task.status == TaskStatus.todo
        assert task.priority == TaskPriority.medium
        assert task.description is None
        assert task.due_date is None

    def test_accepts_full_payload(self):
        task = ExtractedTask(
            title="Deploy to production",
            description="Deploy v2.0 with zero downtime",
            status="in_progress",
            priority="high",
            due_date="2026-06-01",
        )
        assert task.title == "Deploy to production"
        assert task.status == TaskStatus.in_progress
        assert task.priority == TaskPriority.high
        assert task.due_date == "2026-06-01"

    def test_normalizes_iso_datetime_to_date(self):
        # Le validator doit tronquer "2026-06-01T12:00:00" en "2026-06-01"
        task = ExtractedTask(title="T", due_date="2026-06-01T12:00:00")
        assert task.due_date == "2026-06-01"

    def test_rejects_title_too_long(self):
        with pytest.raises(ValidationError):
            ExtractedTask(title="x" * 201)

    def test_rejects_empty_title(self):
        with pytest.raises(ValidationError):
            ExtractedTask(title="")

    def test_rejects_invalid_status(self):
        with pytest.raises(ValidationError):
            ExtractedTask(title="T", status="pending")  # type: ignore[arg-type]

    def test_rejects_invalid_priority(self):
        with pytest.raises(ValidationError):
            ExtractedTask(title="T", priority="urgent")  # type: ignore[arg-type]

    def test_due_date_none_on_empty_string(self):
        task = ExtractedTask(title="T", due_date="")
        assert task.due_date is None

    def test_due_date_none_on_invalid_format(self):
        # Les hallucinations LLM peuvent renvoyer "tomorrow" — doit être null
        task = ExtractedTask(title="T", due_date="tomorrow")
        assert task.due_date is None

    def test_due_date_none_on_non_string(self):
        # Un int ne doit pas passer
        task = ExtractedTask(title="T", due_date=20260601)  # type: ignore[arg-type]
        assert task.due_date is None

    def test_due_date_accepts_valid_iso(self):
        task = ExtractedTask(title="T", due_date="2026-12-31")
        assert task.due_date == "2026-12-31"

    def test_all_statuses_accepted(self):
        for status in ("todo", "in_progress", "done"):
            t = ExtractedTask(title="T", status=status)  # type: ignore[arg-type]
            assert t.status.value == status

    def test_all_priorities_accepted(self):
        for priority in ("low", "medium", "high"):
            t = ExtractedTask(title="T", priority=priority)  # type: ignore[arg-type]
            assert t.priority.value == priority


# ─── TaskAssistantResponse ─────────────────────────────────────────────────────

class TestTaskAssistantResponse:
    def test_accepts_empty_task_list(self):
        res = TaskAssistantResponse(tasks=[], raw_text="nothing here")
        assert res.tasks == []
        assert res.raw_text == "nothing here"

    def test_accepts_multiple_tasks(self):
        tasks = [
            ExtractedTask(title="Task A"),
            ExtractedTask(title="Task B", priority="high"),
        ]
        res = TaskAssistantResponse(tasks=tasks, raw_text="Task A and Task B")
        assert len(res.tasks) == 2


# ─── SmartSearchRequest ────────────────────────────────────────────────────────

class TestSmartSearchRequest:
    def test_accepts_valid_query(self):
        req = SmartSearchRequest(query="overdue tasks")
        assert req.query == "overdue tasks"

    def test_rejects_empty_query(self):
        with pytest.raises(ValidationError):
            SmartSearchRequest(query="")

    def test_rejects_query_too_long(self):
        with pytest.raises(ValidationError):
            SmartSearchRequest(query="x" * 501)

    def test_accepts_query_at_max_length(self):
        req = SmartSearchRequest(query="x" * 500)
        assert len(req.query) == 500


# ─── SearchFilters ─────────────────────────────────────────────────────────────

class TestSearchFilters:
    def test_all_fields_default_to_none_or_empty(self):
        filters = SearchFilters()
        assert filters.status is None
        assert filters.priority is None
        assert filters.keywords == []
        assert filters.due_before is None
        assert filters.due_after is None
        assert filters.interpretation == ""

    def test_accepts_full_payload(self):
        filters = SearchFilters(
            status="todo",
            priority="high",
            keywords=["bug", "login"],
            due_before="2026-04-10",
            due_after="2026-04-01",
            interpretation="High priority todo tasks due this week",
        )
        assert filters.status == TaskStatus.todo
        assert filters.priority == TaskPriority.high
        assert filters.keywords == ["bug", "login"]

    def test_rejects_invalid_status(self):
        with pytest.raises(ValidationError):
            SearchFilters(status="invalid")  # type: ignore[arg-type]

    def test_rejects_invalid_priority(self):
        with pytest.raises(ValidationError):
            SearchFilters(priority="urgent")  # type: ignore[arg-type]


# ─── SmartSearchResponse ──────────────────────────────────────────────────────

class TestSmartSearchResponse:
    def test_stores_filters_and_query(self):
        res = SmartSearchResponse(
            filters=SearchFilters(interpretation="Done tasks"),
            original_query="completed tasks",
        )
        assert res.original_query == "completed tasks"
        assert res.filters.interpretation == "Done tasks"


# ─── TaskInput ─────────────────────────────────────────────────────────────────

class TestTaskInput:
    def test_accepts_minimal_payload(self):
        t = TaskInput(id="t1", title="Fix bug", status="todo")
        assert t.id == "t1"
        assert t.priority == TaskPriority.medium  # default
        assert t.due_date is None
        assert t.is_overdue is False

    def test_accepts_full_payload(self):
        t = TaskInput(
            id="t2",
            title="Deploy",
            status="in_progress",
            priority="high",
            due_date="2026-04-01",
            is_overdue=True,
        )
        assert t.is_overdue is True
        assert t.priority == TaskPriority.high


# ─── TaskStat ──────────────────────────────────────────────────────────────────

class TestTaskStat:
    def test_all_defaults_to_zero(self):
        s = TaskStat()
        assert s.total == 0
        assert s.todo == 0
        assert s.in_progress == 0
        assert s.done == 0
        assert s.overdue == 0
        assert s.high_priority == 0

    def test_accepts_custom_values(self):
        s = TaskStat(total=10, todo=4, in_progress=3, done=3, overdue=2, high_priority=1)
        assert s.total == 10


# ─── DashboardSummaryRequest ───────────────────────────────────────────────────

class TestDashboardSummaryRequest:
    def test_accepts_empty_task_list(self):
        req = DashboardSummaryRequest(tasks=[], stats=TaskStat())
        assert req.tasks == []

    def test_accepts_tasks_and_stats(self):
        tasks = [
            TaskInput(id="t1", title="A", status="todo"),
            TaskInput(id="t2", title="B", status="done"),
        ]
        stats = TaskStat(total=2, todo=1, done=1)
        req = DashboardSummaryRequest(tasks=tasks, stats=stats)
        assert len(req.tasks) == 2
        assert req.stats.total == 2


# ─── DashboardSummaryResponse ──────────────────────────────────────────────────

class TestDashboardSummaryResponse:
    def test_accepts_full_payload(self):
        res = DashboardSummaryResponse(
            summary="You have 5 tasks.",
            top_priorities=["Fix login bug", "Write tests"],
            suggested_actions=[
                SuggestedAction(action="Start with the overdue task", reason="It blocks others")
            ],
            urgent_tasks=["Fix login bug"],
        )
        assert res.summary == "You have 5 tasks."
        assert len(res.top_priorities) == 2
        assert len(res.suggested_actions) == 1
        assert len(res.urgent_tasks) == 1

    def test_accepts_empty_lists(self):
        res = DashboardSummaryResponse(
            summary="All done!",
            top_priorities=[],
            suggested_actions=[],
            urgent_tasks=[],
        )
        assert res.urgent_tasks == []


# ─── Enum values ──────────────────────────────────────────────────────────────

class TestEnums:
    def test_task_status_values(self):
        assert TaskStatus.todo.value == "todo"
        assert TaskStatus.in_progress.value == "in_progress"
        assert TaskStatus.done.value == "done"

    def test_task_priority_values(self):
        assert TaskPriority.low.value == "low"
        assert TaskPriority.medium.value == "medium"
        assert TaskPriority.high.value == "high"

    def test_status_is_str(self):
        # Les enums héritent de str pour la sérialisation JSON directe
        assert isinstance(TaskStatus.todo, str)

    def test_priority_is_str(self):
        assert isinstance(TaskPriority.high, str)
