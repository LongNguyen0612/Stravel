import random
import re
import uuid as _uuid
from datetime import date, timedelta

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.traveler_profile import TravelerProfile

logger = structlog.get_logger()

VIETNAM_CITIES = [
    "Hanoi", "Ho Chi Minh City", "Da Nang", "Hoi An", "Hue",
    "Nha Trang", "Phu Quoc", "Ha Long Bay", "Sapa", "Da Lat",
    "Can Tho", "Vung Tau", "Mui Ne", "Ninh Binh", "Quy Nhon",
    "Phan Thiet", "Con Dao", "Lang Co", "Bac Ha", "Mai Chau",
]

DEFAULT_TRAVELER_COUNT = 2
DEFAULT_BUDGET_TOTAL = 2500.0
DEFAULT_BUDGET_CURRENCY = "USD"
DEFAULT_ACCOMMODATION_STYLE = "mid-range"
DEFAULT_ACTIVITY_PREFERENCES = ["sightseeing", "local food"]
DEFAULT_DURATION_DAYS = 7
DEFAULT_START_DAYS_FROM_NOW = 30

_SURPRISE_DURATIONS = [5, 7, 10]

_DURATION_PATTERNS: list[tuple[str, object]] = [
    (r"(\d+)\s+(?:days?|nights?)", lambda m: int(m.group(1))),
    (r"a\s+week", lambda _: 7),
    (r"(\d+)\s+weeks?", lambda m: int(m.group(1)) * 7),
]


def detect_intent(message: str) -> dict:
    """Extract destination, duration, and surprise-me flag from a raw user message."""
    is_surprise = bool(re.search(r"\bsurprise\s+me\b", message, re.I))

    destination: str | None = None
    if not is_surprise:
        for city in VIETNAM_CITIES:
            if re.search(r"\b" + re.escape(city) + r"\b", message, re.I):
                destination = city
                break

    duration_days: int | None = None
    for pattern, extractor in _DURATION_PATTERNS:
        m = re.search(pattern, message, re.I)
        if m:
            duration_days = extractor(m)  # type: ignore[operator]
            break

    return {
        "destination": destination,
        "duration_days": duration_days,
        "is_surprise_me": is_surprise,
    }


async def build_profile_with_defaults(
    session_id: str,
    extracted: dict,
    db: AsyncSession,
) -> tuple[dict, list[str]]:
    """
    Merge extracted intent with sensible defaults for a TravelerProfile.
    Returns (patch_dict, assumed_slot_keys) where assumed_slot_keys lists every
    slot that was defaulted (not provided by the user).
    """
    stmt = select(TravelerProfile).where(
        TravelerProfile.advisory_session_id == _uuid.UUID(session_id)
    )
    result = await db.execute(stmt)
    profile = result.scalars().first()

    patch: dict = {}
    assumed: list[str] = []

    # ── Destination ────────────────────────────────────────────────────────
    if extracted.get("is_surprise_me"):
        patch["destination_preferences"] = [random.choice(VIETNAM_CITIES)]
        duration_days = random.choice(_SURPRISE_DURATIONS)
    else:
        patch["destination_preferences"] = [extracted["destination"] or "Vietnam"]
        if not extracted.get("destination"):
            assumed.append("destination")
        duration_days = extracted.get("duration_days")

    # ── Travel dates ───────────────────────────────────────────────────────
    start_date = date.today() + timedelta(days=DEFAULT_START_DAYS_FROM_NOW)
    if duration_days is not None:
        end_date = start_date + timedelta(days=duration_days)
    else:
        end_date = start_date + timedelta(days=DEFAULT_DURATION_DAYS)
        assumed.append("travel_dates")

    patch["travel_start_date"] = start_date
    patch["travel_end_date"] = end_date

    # ── Traveler count ─────────────────────────────────────────────────────
    existing_count = getattr(profile, "traveler_count", None) if profile else None
    if existing_count is None:
        patch["traveler_count"] = DEFAULT_TRAVELER_COUNT
        assumed.append("traveler_count")

    # ── Budget ─────────────────────────────────────────────────────────────
    existing_budget = getattr(profile, "budget_total", None) if profile else None
    if existing_budget is None:
        patch["budget_total"] = DEFAULT_BUDGET_TOTAL
        patch["budget_currency"] = DEFAULT_BUDGET_CURRENCY
        assumed.append("budget")

    # ── Accommodation ──────────────────────────────────────────────────────
    existing_accommodation = getattr(profile, "accommodation_style", None) if profile else None
    if existing_accommodation is None:
        patch["accommodation_style"] = DEFAULT_ACCOMMODATION_STYLE

    # ── Activity preferences ───────────────────────────────────────────────
    existing_activities = getattr(profile, "activity_preferences", None) if profile else None
    if existing_activities is None:
        patch["activity_preferences"] = list(DEFAULT_ACTIVITY_PREFERENCES)
        assumed.append("activities")

    logger.info(
        "propose_first.profile_built",
        session_id=session_id,
        assumed_slots=assumed,
        destination=patch.get("destination_preferences"),
    )
    return patch, assumed


def compose_commitment_message(patch: dict, extracted: dict) -> str:
    """Build the bot's immediate commitment message from the resolved patch dict."""
    destination = (patch.get("destination_preferences") or ["Vietnam"])[0]
    start_date: date = patch["travel_start_date"]
    end_date: date = patch["travel_end_date"]
    duration = (end_date - start_date).days
    traveler_count = patch.get("traveler_count", DEFAULT_TRAVELER_COUNT)

    surprise_prefix = "Ooh, leaving it up to fate! " if extracted.get("is_surprise_me") else ""
    return (
        f"{surprise_prefix}I'll plan a {duration}-day trip to {destination} "
        f"for {traveler_count} traveller{'s' if traveler_count != 1 else ''} "
        f"starting around {start_date.strftime('%B %d, %Y')}. "
        "Building your proposal now…"
    )
