"""Passport OCR endpoint — POST /api/v1/passport/extract-expiry."""

import asyncio

import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.services.ocr import PassportOCRResponse, create_ocr_service

router = APIRouter(prefix="/passport", tags=["passport"])
logger = structlog.get_logger()

_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_OCR_TIMEOUT = 15.0


@router.post("/extract-expiry", response_model=None)
async def extract_expiry(file: UploadFile = File(...)) -> PassportOCRResponse:
    """Extract passport expiry date from an uploaded image.

    The image is processed in memory only and never persisted.
    """
    image_bytes = await file.read()

    if len(image_bytes) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")

    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported image format")

    ocr = create_ocr_service()
    try:
        result = await asyncio.wait_for(
            ocr.extract_expiry(image_bytes, file.content_type or ""),
            timeout=_OCR_TIMEOUT,
        )
    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=504,
            content={"detail": "OCR timeout", "fallback_required": True},
        )
    finally:
        del image_bytes

    return result
