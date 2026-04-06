"""
Service Dashboard Summary — V2 (stub).

Générera un résumé actionnable à partir des tâches et statistiques utilisateur :
- Résumé 2-3 phrases
- Top 3 priorités du jour
- Suggestions d'actions concrètes
- Tâches urgentes (overdue + high-priority)

À implémenter en V2.
"""
from __future__ import annotations

from ai_service.models.schemas import DashboardSummaryRequest, DashboardSummaryResponse


async def generate_dashboard_summary(request: DashboardSummaryRequest) -> DashboardSummaryResponse:
    raise NotImplementedError("Dashboard Summary will be implemented in V2.")
