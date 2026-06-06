"""
per-feature sharing settings.

each shareable card on a user's profile (now playing, top artists, minutes,
listening clock, taste match) has its own visibility, mirroring the same
three-way model as ActivityVisibility. `nowplaying` is kept in sync with the
user's `activity_visibility` column (the single source of truth used by the
realtime broadcaster), so the live websocket path stays enforced.
"""
from typing import Literal, Optional

from app.core.constants import ActivityVisibility

# keys must match the frontend orbit chips
SHAREABLE_KEYS = ["nowplaying", "topartists", "minutes", "clock", "match"]

_VALID = {v.value for v in ActivityVisibility}

Relation = Literal["self", "friend", "stranger"]


def default_share_settings() -> dict[str, str]:
    """sensible defaults for a brand-new profile"""
    return {
        "nowplaying": ActivityVisibility.FRIENDS_ONLY.value,
        "topartists": ActivityVisibility.PUBLIC.value,
        "minutes": ActivityVisibility.FRIENDS_ONLY.value,
        "clock": ActivityVisibility.PRIVATE.value,
        "match": ActivityVisibility.FRIENDS_ONLY.value,
    }


def normalize_share_settings(
    raw: Optional[dict],
    activity_visibility: str,
) -> dict[str, str]:
    """
    fill any missing/invalid keys from defaults and force
    nowplaying == activity_visibility (single source of truth).
    """
    result = default_share_settings()
    if raw:
        for key in SHAREABLE_KEYS:
            value = raw.get(key)
            if value in _VALID:
                result[key] = value
    # nowplaying always mirrors the canonical activity_visibility
    if activity_visibility in _VALID:
        result["nowplaying"] = activity_visibility
    return result


def is_field_visible(setting_value: str, relation: Relation) -> bool:
    """whether a viewer in `relation` may see a field with this visibility"""
    if relation == "self":
        return True
    if setting_value == ActivityVisibility.PRIVATE.value:
        return False
    if setting_value == ActivityVisibility.PUBLIC.value:
        return True
    # friends_only
    return relation == "friend"
