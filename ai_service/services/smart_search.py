"""
Service Smart Search.
Convertit une requête en langage naturel en filtres structurés
compatibles avec l'API /api/tasks existante.
"""
from __future__ import annotations

from datetime import date

from ai_service.models.schemas import SmartSearchRequest, SmartSearchResponse, SearchFilters
from ai_service.providers.openai_provider import call_llm_json

_SYSTEM_PROMPT = """\
You are a task search query parser. Parse the user's natural-language query and return \
a JSON object that strictly follows this schema:

{
  "status": "todo" | "in_progress" | "done" | null,
  "priority": "low" | "medium" | "high" | null,
  "keywords": ["string", ...],
  "due_before": "YYYY-MM-DD" | null,
  "due_after": "YYYY-MM-DD" | null,
  "interpretation": "One sentence explaining what you understood from the query"
}

Rules:
- Set a field to null if not mentioned or not clearly inferable.
- keywords: extract meaningful words that should match task titles or descriptions. Max 5.
- due_before / due_after: resolve relative dates (today, tomorrow, next week) using the date provided.
- interpretation: always a concise English sentence summarizing what was searched.
- Return ONLY the JSON object. No markdown, no extra keys.
"""


async def parse_search_query(request: SmartSearchRequest) -> SmartSearchResponse:
    today = date.today().isoformat()
    user_prompt = f"Today is {today}.\n\nSearch query: {request.query}"

    filters = await call_llm_json(
        system_prompt=_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_schema=SearchFilters,
        temperature=0.1,
    )

    return SmartSearchResponse(filters=filters, original_query=request.query)
