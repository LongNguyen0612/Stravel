import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.auth import create_access_token, get_current_user_token, hash_password, verify_password
from app.core.database import get_session
from app.core.exceptions import AppError
from app.models.tenant import Tenant, TenantUser
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
logger = structlog.get_logger()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)) -> dict:
    existing = await session.execute(select(TenantUser).where(TenantUser.email == body.email))
    if existing.scalars().first():
        raise AppError(code="EMAIL_EXISTS", message="Email already registered", status_code=409)

    tenant = Tenant(name=body.tenant_name or f"{body.email}'s Agency")
    session.add(tenant)
    await session.flush()

    user = TenantUser(
        tenant_id=tenant.id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    session.add(user)
    await session.commit()

    token = create_access_token(str(tenant.id), str(user.id), user.email)
    logger.info("auth.registered", email=body.email, tenant_id=str(tenant.id))
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)) -> dict:
    result = await session.execute(select(TenantUser).where(TenantUser.email == body.email))
    user = result.scalars().first()

    if not user or not verify_password(body.password, user.hashed_password):
        raise AppError(code="INVALID_CREDENTIALS", message="Invalid email or password", status_code=401)

    if not user.is_active:
        raise AppError(code="USER_INACTIVE", message="User account is inactive", status_code=403)

    token = create_access_token(str(user.tenant_id), str(user.id), user.email)
    logger.info("auth.login", email=body.email)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    token: dict = Depends(get_current_user_token),
    session: AsyncSession = Depends(get_session),
) -> dict:
    result = await session.execute(select(TenantUser).where(TenantUser.id == token["sub"]))
    user = result.scalars().first()
    if not user:
        raise AppError(code="USER_NOT_FOUND", message="User not found", status_code=404)
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "tenant_id": str(user.tenant_id),
    }
