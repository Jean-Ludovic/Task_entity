"""
Service Smart Search — V1.

Convertit une requête en langage naturel en filtres structurés
directement utilisables comme query params pour /api/tasks.

Responsabilités :
- Construire le prompt système + utilisateur
- Appeler le provider LLM
- Retourner une SmartSearchResponse validée par Pydantic
"""
from __future__ import annotations

from datetime import date

from ai_service.models.schemas import (
    SearchFilters,
    SmartSearchRequest,
    SmartSearchResponse,
)
from ai_service.providers.openai_provider import call_llm_json

_SYSTEM_PROMPT = """\
You are a task search filter engine. Convert natural language search queries into structured filters.

Return ONLY a JSON object with this exact structure:
{
  "status": "todo" | "in_progress" | "done" | null,
  "priority": "low" | "medium" | "high" | null,
  "keywords": ["word1", "word2"],
  "due_before": "YYYY-MM-DD" | null,
  "due_after": "YYYY-MM-DD" | null,
  "interpretation": "brief sentence describing what the user is searching for"
}

Rules — follow ALL of them:
1. status → extract only if the query explicitly mentions a status:
   "todo", "pending", "not started" → "todo"
   "in progress", "ongoing", "working on" → "in_progress"
   "done", "completed", "finished" → "done"
   Otherwise → null.
2. priority → extract only if the query mentions urgency:
   "urgent", "critical", "important", "ASAP" → "high"
   "low priority", "minor", "someday", "whenever" → "low"
   "medium" / "normal" → "medium"
   Otherwise → null.
3. keywords → extract meaningful words that could appear in task titles or descriptions.
   Exclude stop words (the, is, a, etc.). Empty array if no meaningful keywords.
4. due_before / due_after → resolve relative dates from today's date provided in the user message.
   Use YYYY-MM-DD format only.
   Examples:
   - "due this week" → due_before = last day of current week (Sunday)
   - "due today" → due_before = today, due_after = today
   - "overdue" → due_before = today (tasks whose due date is before today)
   - "due next month" → due_before = last day of next month
   - "due tomorrow" → due_before = tomorrow, due_after = tomorrow
   → null if no date constraint is mentioned.
5. interpretation → 1 concise sentence: "High priority tasks due this week", "Completed tasks", etc.
6. Return null for any field you cannot confidently determine.
7. Return ONLY the JSON object. No markdown fences, no explanation.
"""


async def parse_search_query(request: SmartSearchRequest) -> SmartSearchResponse:
    """
    Point d'entrée du service.
    Appelle le LLM et retourne une SmartSearchResponse validée.
    """
    today = date.today().isoformat()
    user_prompt = f"Today's date: {today}\n\nSearch query: {request.query}"

    result = await call_llm_json(
        system_prompt=_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_schema=SearchFilters,
        temperature=0.1,
    )

    return SmartSearchResponse(
        filters=result,
        original_query=request.query,
    )
