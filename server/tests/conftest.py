# The app reads its config at import time, so the environment has to be set
# before importing it; pytest fixtures shadow their own names by design.
# pylint: disable=wrong-import-position,redefined-outer-name

import os
import tempfile
from pathlib import Path

import pytest

TMP = Path(tempfile.mkdtemp(prefix="fitness-test-"))
os.environ["FITNESS_DATA_DIR"] = str(TMP)
os.environ["DATABASE_URL"] = f"sqlite:///{TMP / 'test.db'}"
os.environ["JWT_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "ethan@example.com",
            "display_name": "Ethan",
            "password": "barbell-squats",
            "unit": "lb",
        },
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
