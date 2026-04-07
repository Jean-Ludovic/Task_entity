"""
Service Task Assistant — V1.

Transforme du texte libre en liste de tâches structurées via LLM.

Responsabilités :
- Construire le prompt système et utilisateur
- Appeler le provider LLM
- Retourner une TaskAssistantResponse validée par Pydantic

Ce service ne connaît pas FastAPI, ne gère pas les erreurs HTTP.
Il lève uniquement LLMError (propagée jusqu'à la route).
"""
from __future__ import annotations

from datetime import date

from ai_service.models.schemas import (
    TaskAssistantRequest,
    TaskAssistantResponse,
)
from ai_service.providers.openai_provider import call_llm_json

# ─── Prompt système ────────────────────────────────────────────────────────────
# Règles explicites pour contraindre le LLM à retourner un JSON propre.
# Toute ambiguïté dans le prompt se retrouve dans les réponses → soyons précis.

_SYSTEM_PROMPT = """\
You are a task extraction engine. Your ONLY job is to parse the user's text and \
return a JSON object with this exact structure:

{
  "tasks": [
    {
      "title": "string (required, max 200 chars, action-oriented)",
      "description": "string or null (additional context if present)",
      "status": "todo" | "in_progress" | "done",
      "priority": "low" | "medium" | "high",
      "due_date": "YYYY-MM-DD" | null
    }
  ]
}

Rules — follow ALL of them:
1. Extract EVERY distinct actionable task mentioned. Do NOT merge separate tasks.
2. If no task can be extracted, return {"tasks": []}.
3. NEVER invent tasks not implied by the text.
4. status → default "todo" unless text says the task is ongoing or done.
5. priority → "high" if urgent/ASAP/critical, "low" if low importance, "medium" otherwise.
6. due_date → use YYYY-MM-DD format ONLY. Today's date is given in the user message. \
   Resolve "tomorrow", "next week", etc. from that date. If no date is mentioned → null.
7. title → start with an action verb (e.g. "Write", "Fix", "Call", "Review").
8. Return ONLY the JSON object. No markdown fences, no explanation, no extra keys.
"""


async def extract_tasks(request: TaskAssistantRequest) -> TaskAssistantResponse:
    """
    Point d'entrée du service.
    Appelle le LLM et retourne une TaskAssistantResponse validée.
    """
    today = date.today().isoformat()
    user_prompt = f"Today's date: {today}\n\nText to parse:\n{request.text}"

    # _LLMResult wraps TaskAssistantResponse pour que le provider puisse valider
    # {"tasks": [...], "raw_text": ...} — on injecte raw_text nous-mêmes.
    class _LLMResult(TaskAssistantResponse):
        raw_text: str = request.text

    result = await call_llm_json(
        system_prompt=_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_schema=_LLMResult,
        temperature=0.1,  # déterminisme maximum pour l'extraction structurée
    )

    return TaskAssistantResponse(tasks=result.tasks, raw_text=request.text)
