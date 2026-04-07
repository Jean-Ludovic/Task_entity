"""
Schémas Pydantic partagés entre tous les services IA.
Chaque feature (task-assistant, smart-search, dashboard-summary) a ses propres I/O.
Ce fichier est l'unique source de vérité pour les contrats d'API.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator


# ─── Shared enums ─────────────────────────────────────────────────────────────

class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


# ─── Task Assistant ────────────────────────────────────────────────────────────

class TaskAssistantRequest(BaseModel):
    text: Annotated[str, Field(min_length=3, max_length=4000)]


class ExtractedTask(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: str | None = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    due_date: str | None = Field(
        default=None,
        description="ISO 8601 date (YYYY-MM-DD) ou null",
    )

    @field_validator("due_date", mode="before")
    @classmethod
    def validate_due_date(cls, v: object) -> str | None:
        # Les hallucinations LLM retournent parfois "tomorrow" ou un format invalide.
        # On accepte uniquement un ISO date valide, sinon on force null.
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            return None
        try:
            datetime.fromisoformat(v.split("T")[0])
        except ValueError:
            return None
        return v.split("T")[0]  # normalise en YYYY-MM-DD


class TaskAssistantResponse(BaseModel):
    tasks: list[ExtractedTask]
    raw_text: str


# ─── Smart Search (V2 — stubs uniquement) ─────────────────────────────────────

class SmartSearchRequest(BaseModel):
    query: Annotated[str, Field(min_length=1, max_length=500)]


class SearchFilters(BaseModel):
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    keywords: list[str] = Field(default_factory=list)
    due_before: str | None = None
    due_after: str | None = None
    interpretation: str = ""


class SmartSearchResponse(BaseModel):
    filters: SearchFilters
    original_query: str


# ─── Dashboard Summary (V2 — stubs uniquement) ────────────────────────────────

class TaskStat(BaseModel):
    total: int = 0
    todo: int = 0
    in_progress: int = 0
    done: int = 0
    overdue: int = 0
    high_priority: int = 0


class TaskInput(BaseModel):
    id: str
    title: str
    status: TaskStatus
    priority: TaskPriority = TaskPriority.medium
    due_date: str | None = None
    is_overdue: bool = False


class DashboardSummaryRequest(BaseModel):
    tasks: list[TaskInput]
    stats: TaskStat


class SuggestedAction(BaseModel):
    action: str
    reason: str


class DashboardSummaryResponse(BaseModel):
    summary: str
    top_priorities: list[str]
    suggested_actions: list[SuggestedAction]
    urgent_tasks: list[str]
