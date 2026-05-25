from contextvars import ContextVar

from fastapi import Depends

from app.core.auth import get_current_user_token

_tenant_id: ContextVar[str] = ContextVar("tenant_id", default="")

PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/demo",
    "/docs",
    "/openapi.json",
}


def set_tenant_id(tenant_id: str) -> None:
    _tenant_id.set(tenant_id)


def get_tenant_id() -> str:
    return _tenant_id.get()


async def require_tenant(token: dict = Depends(get_current_user_token)) -> str:
    """FastAPI dependency that extracts tenant_id from JWT and sets context."""
    tenant_id = token.get("tenant_id", "")
    if not tenant_id:
        from app.core.exceptions import AppError

        raise AppError(code="MISSING_TENANT", message="Token missing tenant_id", status_code=401)
    set_tenant_id(tenant_id)
    return tenant_id
