"""
Service Dashboard Summary.
Génère un résumé actionnable à partir des tâches et statistiques utilisateur.
"""
from __future__ import annotations

import json

from ai_service.models.schemas import (
    DashboardSummaryRequest,
    DashboardSummaryResponse,
)
from ai_service.providers.openai_provider import call_llm_json

_SYSTEM_PROMPT = """\
You are a productivity assistant. Given a user's task data, produce a concise actionable \
dashboard summary as a JSON object:

{
  "summary": "2-3 sentence overview of the user's current workload and overall status",
  "top_priorities": ["task title 1", "task title 2", "task title 3"],
  "suggested_actions": [
    {"action": "short imperative action", "reason": "why this matters right now"}
  ],
  "urgent_tasks": ["task title 1", ...]
}

Rules:
- top_priorities: max 3 task titles the user should focus on today. Choose overdue or high-priority.
- suggested_actions: max 3 concrete next steps. Be specific (e.g. "Start 'Fix login bug' — it's blocking others").
- urgent_tasks: tasks that are overdue OR (high-priority AND not done). Max 5.
- summary: be direct, no fluff. Mention what's done well and what needs attention.
- If tasks list is empty, return helpful placeholder content.
- Return ONLY the JSON object. No markdown, no explanation.
"""


async def generate_dashboard_summary(
    request: DashboardSummaryRequest,
) -> DashboardSummaryResponse:
    payload = {
        "stats": request.stats.model_dump(),
        "tasks": [t.model_dump() for t in request.tasks[:50]],
    }
    user_prompt = json.dumps(payload, default=str)

    return await call_llm_json(
        system_prompt=_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_schema=DashboardSummaryResponse,
        temperature=0.3,
    )
