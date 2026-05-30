import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import create_access_token
from app.main import app

_TEST_TENANT_ID = "default"
_TEST_USER_ID = "test-user-001"
_TEST_EMAIL = "test@stravel.local"


def _test_token() -> str:
    return create_access_token(
        tenant_id=_TEST_TENANT_ID,
        user_id=_TEST_USER_ID,
        email=_TEST_EMAIL,
    )


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {_test_token()}"}
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac
