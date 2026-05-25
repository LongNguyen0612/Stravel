import unicodedata


def normalize_name(name: str) -> str:
    """Normalize entity name for deduplication: lowercase, strip diacritics, collapse whitespace."""
    name = name.lower().strip()
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return " ".join(name.split())


def is_location_match(lat1: float | None, lng1: float | None, lat2: float | None, lng2: float | None) -> bool:
    """Check if two locations are within ~100m of each other."""
    if any(v is None for v in [lat1, lng1, lat2, lng2]):
        return False
    return abs(lat1 - lat2) < 0.001 and abs(lng1 - lng2) < 0.001


def is_duplicate(entity_a: dict, entity_b: dict) -> bool:
    """Check if two entities are duplicates based on name + location proximity."""
    name_match = normalize_name(entity_a.get("name", "")) == normalize_name(entity_b.get("name", ""))
    if not name_match:
        return False

    loc_match = is_location_match(
        entity_a.get("location_lat"),
        entity_a.get("location_lng"),
        entity_b.get("location_lat"),
        entity_b.get("location_lng"),
    )

    # If both have locations, require proximity. If either lacks location, name match is enough.
    if entity_a.get("location_lat") is not None and entity_b.get("location_lat") is not None:
        return loc_match

    return name_match
