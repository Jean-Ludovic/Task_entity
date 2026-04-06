"""
Service Smart Search — V2 (stub).

Convertira une requête en langage naturel en filtres structurés
utilisables directement comme query params pour /api/tasks.

À implémenter en V2 :
- Extraction de status, priority, keywords
- Résolution de dates relatives (due_before, due_after)
- Interprétation en langage naturel
"""
from __future__ import annotations

from ai_service.models.schemas import SmartSearchRequest, SmartSearchResponse


async def parse_search_query(request: SmartSearchRequest) -> SmartSearchResponse:
    raise NotImplementedError("Smart Search will be implemented in V2.")
