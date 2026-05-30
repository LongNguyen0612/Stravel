"""Tests for Passport OCR endpoint (Story 8-8)."""

from unittest.mock import AsyncMock, patch


# ─── AC3: Unsupported format → 422 ────────────────────────────────────────────

def test_unsupported_format_pdf(client):
    response = client.post(
        "/api/v1/passport/extract-expiry",
        files={"file": ("passport.pdf", b"fake-pdf-content", "application/pdf")},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Unsupported image format"


def test_unsupported_format_mp4(client):
    response = client.post(
        "/api/v1/passport/extract-expiry",
        files={"file": ("video.mp4", b"fake-mp4", "video/mp4")},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Unsupported image format"


def test_supported_format_jpeg_passes_to_ocr(client):
    """JPEG is an accepted type — should reach OCR (mocked here)."""
    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.return_value = {
            "expiry_date": "2027-06-30",
            "confidence": 0.9,
            "fallback_required": False,
        }
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.jpg", b"fake-jpg", "image/jpeg")},
        )
    assert response.status_code == 200


def test_supported_format_png(client):
    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.return_value = {
            "expiry_date": None,
            "confidence": 0.0,
            "fallback_required": True,
        }
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.png", b"fake-png", "image/png")},
        )
    assert response.status_code == 200


def test_supported_format_webp(client):
    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.return_value = {
            "expiry_date": None,
            "confidence": 0.0,
            "fallback_required": True,
        }
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.webp", b"fake-webp", "image/webp")},
        )
    assert response.status_code == 200


# ─── AC4: File too large → 413 ────────────────────────────────────────────────

def test_file_too_large(client):
    big_bytes = b"x" * (10 * 1024 * 1024 + 1)
    response = client.post(
        "/api/v1/passport/extract-expiry",
        files={"file": ("big.jpg", big_bytes, "image/jpeg")},
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Image too large"


def test_file_exactly_10mb_is_accepted(client):
    """Exactly 10 MB passes — limit is strictly > 10 MB."""
    exactly_10mb = b"x" * (10 * 1024 * 1024)
    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.return_value = {
            "expiry_date": "2027-01-01",
            "confidence": 0.9,
            "fallback_required": False,
        }
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("ok.jpg", exactly_10mb, "image/jpeg")},
        )
    assert response.status_code == 200


# ─── AC1: Response shape ──────────────────────────────────────────────────────

def test_valid_ocr_returns_correct_shape(client):
    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.return_value = {
            "expiry_date": "2027-06-30",
            "confidence": 0.9,
            "fallback_required": False,
        }
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.jpg", b"fake-jpg", "image/jpeg")},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["expiry_date"] == "2027-06-30"
    assert data["confidence"] == 0.9
    assert data["fallback_required"] is False


def test_null_date_sets_fallback_required(client):
    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.return_value = {
            "expiry_date": None,
            "confidence": 0.0,
            "fallback_required": True,
        }
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.jpg", b"fake-jpg", "image/jpeg")},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["expiry_date"] is None
    assert data["fallback_required"] is True


def test_low_confidence_sets_fallback_required(client):
    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.return_value = {
            "expiry_date": "2027-06-30",
            "confidence": 0.5,
            "fallback_required": True,
        }
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.jpg", b"fake-jpg", "image/jpeg")},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["fallback_required"] is True


# ─── AC5: Timeout → 504 ───────────────────────────────────────────────────────

def test_timeout_returns_504(client):
    import asyncio

    with patch("app.api.v1.passport.create_ocr_service") as mock_factory:
        mock_service = AsyncMock()
        mock_service.extract_expiry.side_effect = asyncio.TimeoutError()
        mock_factory.return_value = mock_service
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.jpg", b"fake-jpg", "image/jpeg")},
        )
    assert response.status_code == 504
    data = response.json()
    assert data["detail"] == "OCR timeout"
    assert data["fallback_required"] is True


# ─── AC6: Unsupported provider → fallback ────────────────────────────────────

def test_unsupported_provider_returns_fallback(client):
    """AC6: non-ollama provider logs warning and returns fallback_required=True."""
    with patch("app.services.ocr.settings") as mock_settings:
        mock_settings.passport_ocr_provider = "google_vision"
        mock_settings.ollama_base_url = "http://localhost:11434"
        mock_settings.vision_model = "llava:7b"
        response = client.post(
            "/api/v1/passport/extract-expiry",
            files={"file": ("passport.jpg", b"fake-jpg", "image/jpeg")},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["fallback_required"] is True
    assert data["expiry_date"] is None


# ─── OCR service unit tests ───────────────────────────────────────────────────

def test_parse_date_valid():
    from app.services.ocr import _parse_date
    assert _parse_date("Expiry: 2027-06-15") == "2027-06-15"
    assert _parse_date("2030-12-31") == "2030-12-31"


def test_parse_date_invalid():
    from app.services.ocr import _parse_date
    assert _parse_date("Cannot read the passport") is None
    assert _parse_date("null") is None
    assert _parse_date("") is None


def test_parse_date_invalid_date_value():
    from app.services.ocr import _parse_date
    # Syntactically matches but is invalid date
    assert _parse_date("2027-13-45") is None


def test_fallback_required_when_confidence_below_threshold():
    from app.services.ocr import _make_result
    result = _make_result(expiry_date="2027-01-01", confidence=0.84)
    assert result["fallback_required"] is True


def test_fallback_required_when_no_date():
    from app.services.ocr import _make_result
    result = _make_result(expiry_date=None, confidence=0.0)
    assert result["fallback_required"] is True


def test_fallback_not_required_when_high_confidence():
    from app.services.ocr import _make_result
    result = _make_result(expiry_date="2027-01-01", confidence=0.9)
    assert result["fallback_required"] is False
