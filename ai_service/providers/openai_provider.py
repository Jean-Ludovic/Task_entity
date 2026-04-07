"""
Abstraction du provider LLM.

Supporte deux providers via la variable LLM_PROVIDER :
- "ollama"  → Ollama local (http://localhost:11434/v1) — gratuit, pour dev local
- "openai"  → API OpenAI — pour production Vercel

L'API Ollama est compatible OpenAI, donc on utilise le même client AsyncOpenAI
avec juste un base_url différent. Les services métier ne voient aucune différence.

Garanties :
- Réponse JSON stricte (response_format json_object)
- Timeout configurable (plus long pour Ollama local)
- Validation Pydantic de la réponse
- LLMError typée avec status_code HTTP pour le layer route
"""
from __future__ import annotations

import json
import logging
from typing import Any, TypeVar

from openai import AsyncOpenAI, APITimeoutError, APIError
from pydantic import BaseModel, ValidationError

from ai_service.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    """
    Erreur remontée par le provider LLM.
    status_code permet à la route FastAPI de retourner le bon HTTP status.
    """
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _build_client() -> AsyncOpenAI:
    """
    Construit le client LLM selon LLM_PROVIDER.
    Ollama expose une API compatible OpenAI sur /v1 — même client, base_url différente.
    """
    if settings.llm_provider == "ollama":
        return AsyncOpenAI(
            api_key="ollama",  # Ollama n'a pas besoin de clé — valeur ignorée
            base_url=settings.ollama_base_url,
            timeout=float(settings.llm_timeout_seconds),
            max_retries=0,  # Pas de retry sur Ollama local (inutile si le process est down)
        )
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=float(settings.llm_timeout_seconds),
        max_retries=settings.llm_max_retries,
    )


def _get_model() -> str:
    if settings.llm_provider == "ollama":
        return settings.ollama_model
    return settings.openai_model


async def call_llm_json(
    *,
    system_prompt: str,
    user_prompt: str,
    response_schema: type[T],
    temperature: float = 0.2,
) -> T:
    """
    Appelle le LLM en JSON mode et valide la réponse avec Pydantic.

    - Lève LLMError(504) si timeout
    - Lève LLMError(502) si erreur API ou JSON invalide
    - Lève LLMError(502) si la réponse ne correspond pas au schéma Pydantic
    """
    client = _build_client()

    try:
        completion = await client.chat.completions.create(
            model=_get_model(),
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    except APITimeoutError as exc:
        logger.error("LLM timeout after %ds: %s", settings.llm_timeout_seconds, exc)
        raise LLMError("LLM request timed out. Please retry.", status_code=504) from exc
    except APIError as exc:
        logger.error("OpenAI API error: %s", exc)
        raise LLMError(f"LLM API error: {exc.message}", status_code=502) from exc

    raw = completion.choices[0].message.content or ""
    return _parse_response(raw, response_schema)


def _parse_response(raw: str, schema: type[T]) -> T:
    """
    Parse le JSON brut retourné par le LLM et valide avec Pydantic.

    Gestion des hallucinations de format :
    - Le modèle peut envelopper la liste dans {"tasks": [...]} au lieu de l'objet direct
    - On tente la validation directe, puis on cherche la première valeur si ça échoue
    """
    try:
        data: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("LLM returned non-JSON: %.200s", raw)
        raise LLMError("LLM returned malformed JSON.", status_code=502) from exc

    # Tentative 1 : validation directe
    try:
        return schema.model_validate(data)
    except ValidationError:
        pass

    # Tentative 2 : le modèle a peut-être enveloppé dans un objet racine inattendu
    if isinstance(data, dict) and len(data) == 1:
        try:
            return schema.model_validate(next(iter(data.values())))
        except ValidationError:
            pass

    logger.error("LLM output did not match %s schema: %.500s", schema.__name__, raw)
    raise LLMError("LLM response did not match expected schema.", status_code=502)
