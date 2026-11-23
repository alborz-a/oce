"""System accounts that only a system admin should see (photo importer + QA test accounts)."""

from __future__ import annotations

from typing import Any

# [RSC-IRAN] Step 2.4: System and QA test accounts hidden from regular staff
HIDDEN_SYSTEM_EMAILS = frozenset(
    {
        "mizito-importer@royalstars.co",
        "qa.manager@royalstars.co",
        "qa.member@royalstars.co",
        "qa.guest@royalstars.co",
        "qa.allview@royalstars.co",
    }
)
HIDDEN_SYSTEM_NAMES = frozenset(
    {
        "mizito importer",
        "qa.manager",
        "qa.member",
        "qa.guest",
        "qa.allview",
    }
)


def is_hidden_system_user(email: str | None, full_name: str | None) -> bool:
    e = (email or "").strip().lower()
    n = (full_name or "").strip().lower()
    return (
        e in HIDDEN_SYSTEM_EMAILS
        or n in HIDDEN_SYSTEM_NAMES
        or e.startswith(("qa.", "qa-"))
        or n.startswith(("qa.", "qa "))
    )


def viewer_is_admin(payload: Any) -> bool:
    role = payload.get("role") if isinstance(payload, dict) else getattr(payload, "role", None)
    return role == "admin"
