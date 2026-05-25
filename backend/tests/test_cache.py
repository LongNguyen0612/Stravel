import pytest

from app.services.cache import InMemoryCache


@pytest.fixture
def cache():
    return InMemoryCache()


@pytest.mark.asyncio
async def test_set_and_get(cache):
    await cache.set("key1", "value1")
    result = await cache.get("key1")
    assert result == "value1"


@pytest.mark.asyncio
async def test_get_nonexistent(cache):
    result = await cache.get("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_delete(cache):
    await cache.set("key1", "value1")
    await cache.delete("key1")
    result = await cache.get("key1")
    assert result is None


@pytest.mark.asyncio
async def test_overwrite(cache):
    await cache.set("key1", "value1")
    await cache.set("key1", "value2")
    result = await cache.get("key1")
    assert result == "value2"
