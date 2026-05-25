import os
import time
from collections import defaultdict

import structlog
from fastapi import Request

from app.core.exceptions import AppError

logger = structlog.get_logger()

# In-memory rate limit store: IP -> [(timestamp, ...)]
_requests: dict[str, list[float]] = defaultdict(list)

MAX_REQUESTS_PER_HOUR = int(os.environ.get("DEMO_RATE_LIMIT", "20"))
WINDOW_SECONDS = 3600


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(request: Request) -> None:
    """Check IP-based rate limit for demo endpoints. Raises 429 if exceeded."""
    ip = _get_client_ip(request)
    now = time.time()

    # Clean old entries
    _requests[ip] = [t for t in _requests[ip] if now - t < WINDOW_SECONDS]

    if len(_requests[ip]) >= MAX_REQUESTS_PER_HOUR:
        logger.warning("rate_limit.exceeded", ip=ip, count=len(_requests[ip]))
        raise AppError(
            code="RATE_LIMIT_EXCEEDED",
            message=f"Too many requests. Limit: {MAX_REQUESTS_PER_HOUR}/hour",
            status_code=429,
        )

    _requests[ip].append(now)
