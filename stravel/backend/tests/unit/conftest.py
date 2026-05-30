# Unit test conftest — no app import, no database required

import pytest

import app.services.event_bus as eb


class _NoopRedis:
    """Silent no-op Redis client for tests that don't care about Redis behaviour."""
    async def rpush(self, *a, **k): return 1
    async def expire(self, *a, **k): return True
    async def lrange(self, *a, **k): return []
    async def delete(self, *a, **k): return 1
    async def ping(self): return True


@pytest.fixture(autouse=True)
def disable_redis_for_unit_tests(monkeypatch):
    """
    Prevent unit tests from attempting a real Redis connection by pre-seeding
    _redis_client with a silent no-op. _get_redis() returns the pre-seeded value
    (it's not None) so no network call is made.

    test_redis_event_bus.py overrides _redis_client with its own mock via a
    second autouse fixture (same scope); monkeypatch applies them as a stack so
    the test-file mock wins during the test and both are properly restored.
    """
    original = eb._redis_client
    monkeypatch.setattr(eb, "_redis_client", _NoopRedis())
    yield
    eb._redis_client = original
