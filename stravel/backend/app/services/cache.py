import structlog

logger = structlog.get_logger()


class InMemoryCache:
    """In-memory cache for development/testing. Replaced by RedisCache in production."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str, ttl: int = 3600) -> None:
        self._store[key] = value

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)


class RedisCache:
    """Redis-backed cache implementing CacheProtocol. Gracefully degrades if Redis is unavailable."""

    def __init__(self, url: str = "redis://localhost:6379") -> None:
        self.url = url
        self._client = None

    async def _get_client(self):
        if self._client is None:
            try:
                import redis.asyncio as aioredis

                self._client = aioredis.from_url(self.url, decode_responses=True)
                await self._client.ping()
                logger.info("cache.redis.connected", url=self.url)
            except Exception as e:
                logger.warning("cache.redis.unavailable", error=str(e))
                self._client = None
        return self._client

    async def get(self, key: str) -> str | None:
        client = await self._get_client()
        if client is None:
            return None
        try:
            return await client.get(key)
        except Exception as e:
            logger.warning("cache.get.failed", key=key, error=str(e))
            return None

    async def set(self, key: str, value: str, ttl: int = 3600) -> None:
        client = await self._get_client()
        if client is None:
            return
        try:
            await client.setex(key, ttl, value)
        except Exception as e:
            logger.warning("cache.set.failed", key=key, error=str(e))

    async def delete(self, key: str) -> None:
        client = await self._get_client()
        if client is None:
            return
        try:
            await client.delete(key)
        except Exception as e:
            logger.warning("cache.delete.failed", key=key, error=str(e))

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
