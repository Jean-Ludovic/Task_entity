"""
Service Dashboard Summary — V1.

Génère un résumé actionnable à partir des tâches et statistiques utilisateur.

Responsabilités :
- Formater les données de tâches pour le LLM
- Construire le prompt système + utilisateur
- Retourner une DashboardSummaryResponse validée par Pydantic
"""
from __future__ import annotations

import json
from datetime import date

from ai_service.models.schemas import (
    DashboardSummaryRequest,
    DashboardSummaryResponse,
)
from ai_service.providers.openai_provider import call_llm_json

_SYSTEM_PROMPT = """\
You are a productivity assistant. Analyze the user's tasks and provide concise, actionable insights.

Return ONLY a JSON object with this exact structure:
{
  "summary": "2-3 sentence overview of the current workload and key observations",
  "top_priorities": ["task or area that needs focus 1", "task or area 2", "task or area 3"],
  "suggested_actions": [
    {"action": "concrete action to take", "reason": "why this is important"},
    {"action": "another action", "reason": "brief justification"}
  ],
  "urgent_tasks": ["task title that is overdue or high-priority+due-soon 1", "..."]
}

Rules:
1. summary → 2-3 sentences max. Be specific: mention numbers, actual task titles if relevant.
   Example: "You have 5 tasks in progress and 3 overdue. Focus on the critical items first."
2. top_priorities → List up to 3 specific task titles or focus areas. Use actual task titles from the input.
3. suggested_actions → 2-3 concrete, actionable suggestions. Reason should be 1 sentence max.
4. urgent_tasks → Tasks that are overdue (is_overdue=true) OR (priority="high" AND status != "done").
   List up to 5 task titles. Empty array if none.
5. If there are no tasks or all tasks are done → provide encouraging, appropriate response.
6. Return ONLY the JSON object. No markdown fences, no explanation, no extra keys.
"""


def _format_tasks(request: DashboardSummaryRequest) -> str:
    """
    Formate les données de tâches en texte structuré pour le LLM.
    Limite à 30 tâches pour éviter les prompts trop longs.
    """
    stats = request.stats
    stat_line = (
        f"Stats: {stats.total} total | {stats.todo} todo | "
        f"{stats.in_progress} in_progress | {stats.done} done | "
        f"{stats.overdue} overdue | {stats.high_priority} high_priority"
    )

    # Tâches urgentes en premier pour que le LLM les voie immédiatement
    sorted_tasks = sorted(
        request.tasks,
        key=lambda t: (
            0 if t.is_overdue else 1,
            0 if t.priority == "high" else 1 if t.priority == "medium" else 2,
        ),
    )[:30]

    task_lines = []
    for t in sorted_tasks:
        flags = []
        if t.is_overdue:
            flags.append("OVERDUE")
        if t.priority == "high":
            flags.append("HIGH_PRIORITY")
        flag_str = f" [{', '.join(flags)}]" if flags else ""
        due_str = f" due:{t.due_date}" if t.due_date else ""
        task_lines.append(f"- [{t.status}] {t.title}{due_str}{flag_str}")

    tasks_text = "\n".join(task_lines) if task_lines else "No tasks."
    return f"{stat_line}\n\nTasks:\n{tasks_text}"


async def generate_dashboard_summary(
    request: DashboardSummaryRequest,
) -> DashboardSummaryResponse:
    """
    Point d'entrée du service.
    Appelle le LLM et retourne une DashboardSummaryResponse validée.
    """
    today = date.today().isoformat()
    user_prompt = f"Today's date: {today}\n\n{_format_tasks(request)}"

    return await call_llm_json(
        system_prompt=_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_schema=DashboardSummaryResponse,
        temperature=0.3,  # légère créativité pour des suggestions variées
    )
