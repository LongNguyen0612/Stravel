"""Passport OCR service using Ollama LLaVA vision model."""

import base64
import re
from datetime import datetime
from typing import TypedDict

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()

_OCR_PROMPT = (
    "Look at this passport image. Find the expiry date (also called 'date of expiry' or 'expires'). "
    "Return ONLY the date in YYYY-MM-DD format (e.g. 2027-05-15). "
    "If you cannot read the date clearly, return exactly: null"
)

CONFIDENCE_THRESHOLD = 0.85


class PassportOCRResponse(TypedDict):
    expiry_date: str | None
    confidence: float
    fallback_required: bool


def _parse_date(text: str) -> str | None:
    """Extract and validate a YYYY-MM-DD date from arbitrary text."""
    match = re.search(r"\d{4}-\d{2}-\d{2}", text)
    if not match:
        return None
    raw = match.group()
    try:
        datetime.strptime(raw, "%Y-%m-%d")
        return raw
    except ValueError:
        return None


def _make_result(expiry_date: str | None, confidence: float) -> PassportOCRResponse:
    fallback_required = confidence < CONFIDENCE_THRESHOLD or expiry_date is None
    return PassportOCRResponse(
        expiry_date=expiry_date,
        confidence=confidence,
        fallback_required=fallback_required,
    )


class OllamaVisionOCRService:
    def __init__(self) -> None:
        self.model = settings.vision_model

    async def extract_expiry(self, image_bytes: bytes, content_type: str) -> PassportOCRResponse:
        b64_image = base64.b64encode(image_bytes).decode()
        try:
            async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=20.0) as client:
                response = await client.post(
                    "/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "user", "content": _OCR_PROMPT, "images": [b64_image]}
                        ],
                        "stream": False,
                    },
                )
                response.raise_for_status()
                body = response.json()
                text = body.get("message", {}).get("content", "")
        except (httpx.HTTPError, ValueError):
            logger.warning("ocr.ollama_error", model=self.model)
            result = _make_result(expiry_date=None, confidence=0.0)
            logger.info("ocr.complete", confidence=result["confidence"], fallback_required=result["fallback_required"])
            return result

        expiry_date = _parse_date(text)
        confidence = 0.9 if expiry_date is not None else 0.0
        result = _make_result(expiry_date=expiry_date, confidence=confidence)
        logger.info("ocr.complete", confidence=result["confidence"], fallback_required=result["fallback_required"])
        return result


class _FallbackOCRService:
    async def extract_expiry(self, image_bytes: bytes, content_type: str) -> PassportOCRResponse:
        return _make_result(expiry_date=None, confidence=0.0)


def create_ocr_service() -> OllamaVisionOCRService:
    provider = settings.passport_ocr_provider
    if provider != "ollama":
        logger.warning("ocr.unsupported_provider", provider=provider)
        return _FallbackOCRService()
    return OllamaVisionOCRService()
