import uuid
from datetime import datetime

import pytest


def test_user_preferences_importable():
    from app.models.user_preferences import UserPreferences
    assert UserPreferences is not None


def test_user_preferences_table_name():
    from app.models.user_preferences import UserPreferences
    assert UserPreferences.__tablename__ == "user_preferences"


def test_user_preferences_fields():
    from app.models.user_preferences import UserPreferences
    fields = UserPreferences.model_fields
    assert "id" in fields
    assert "user_id" in fields
    assert "trip_name" in fields
    assert "past_destinations" in fields
    assert "travel_style" in fields
    assert "dietary_restrictions" in fields
    assert "created_at" in fields
    assert "updated_at" in fields


def test_user_preferences_default_factory():
    from app.models.user_preferences import UserPreferences
    prefs = UserPreferences(user_id=uuid.uuid4())
    assert isinstance(prefs.id, uuid.UUID)
    assert isinstance(prefs.created_at, datetime)
    assert isinstance(prefs.updated_at, datetime)
    assert prefs.trip_name is None
    assert prefs.past_destinations is None
    assert prefs.travel_style is None
    assert prefs.dietary_restrictions is None


def test_user_preferences_no_future_annotations():
    import inspect
    import app.models.user_preferences as mod
    src = inspect.getsource(mod)
    assert "from __future__ import annotations" not in src


def test_user_preferences_in_models_init():
    from app.models import UserPreferences
    assert UserPreferences is not None


def test_user_preferences_exported_in_all():
    import app.models as models_pkg
    assert "UserPreferences" in models_pkg.__all__
