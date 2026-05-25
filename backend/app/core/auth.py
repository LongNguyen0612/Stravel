from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.exceptions import AppError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login", auto_error=False)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
MAX_PASSWORD_BYTES = 72  # bcrypt silently truncates beyond this


def _validate_password_length(password: str) -> None:
    if len(password.encode()) > MAX_PASSWORD_BYTES:
        raise AppError(
            code="PASSWORD_TOO_LONG",
            message=f"Password cannot exceed {MAX_PASSWORD_BYTES} bytes",
            status_code=422,
        )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password[:MAX_PASSWORD_BYTES].encode(), hashed_password.encode())


def hash_password(password: str) -> str:
    _validate_password_length(password)
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(tenant_id: str, user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise AppError(code="INVALID_TOKEN", message="Could not validate credentials", status_code=401) from e


async def get_current_user_token(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Dependency that extracts and validates JWT token. Returns token payload."""
    if token is None:
        raise AppError(code="NOT_AUTHENTICATED", message="Not authenticated", status_code=401)
    return decode_access_token(token)
