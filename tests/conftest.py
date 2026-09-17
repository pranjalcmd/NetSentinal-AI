"""Test-wide isolation for the database.

Without this, importing `backend.app.main` writes analysis history into the
real `./netsentinel.db` — every run leaves rows behind, and a test asserting
"2 jobs in history" starts passing or failing based on runs from last week.

Autouse and session-scoped: the path is redirected before the first
`TestClient` startup hook runs `db.init()`, so no test has to know about it.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))   # tests import each other's builders


@pytest.fixture(scope="session", autouse=True)
def _isolated_database():
    from backend.app.core.config import settings

    with tempfile.TemporaryDirectory() as tmp:
        settings.database_path = str(Path(tmp) / "test.db")
        yield settings.database_path
