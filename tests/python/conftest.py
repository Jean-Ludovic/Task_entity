"""
Configuration pytest partagée pour tous les tests Python.

Fixtures disponibles :
- client : FastAPI TestClient (synchrone) avec le secret header désactivé
- authenticated_client : idem mais avec X-AI-Secret-Key si AI_SECRET_KEY est défini
"""
from __future__ import annotations

import os
import sys

# S'assure que la racine du projet est dans le sys.path pour les imports ai_service.*
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    """
    Client de test FastAPI.
    AI_SECRET_KEY est vide → aucun header requis.
    """
    # Neutralise le secret pour que tous les tests passent sans header
    os.environ.setdefault("AI_SECRET_KEY", "")

    # Import tardif pour que les variables d'env soient lues
    from api.ai import app
    with TestClient(app) as c:
        yield c
