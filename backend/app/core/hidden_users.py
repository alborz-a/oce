"""System accounts that only a system admin should see (the photo import account)."""

from __future__ import annotations

from typing import Any

HIDDEN_SYSTEM_EMAILS = frozenset({"mizito-importer@royalstars.co"})
HIDDEN_SYSTEM_NAMES = frozenset({"mizito importer"})


def is_hidden_system_user(email: str | None, full_name: str | None) -> bool:
    return (email or "").strip().lower() in HIDDEN_SYSTEM_EMAILS or (full_name or "").strip().lower() in HIDDEN_SYSTEM_NAMES


def viewer_is_admin(payload: Any) -> bool:
    role = payload.get("role") if isinstance(payload, dict) else getattr(payload, "role", None)
    return role == "admin"
