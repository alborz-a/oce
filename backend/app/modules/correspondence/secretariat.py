# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Secretariat registration (ثبت در دبیرخانه) of mailbox letters.

Number format: ``<prefix>- <number> -<postfix>``, e.g. ``ق- ۲۳۷ -۴۰۵``.

* prefix: one of ``PREFIXES``; a category tag, it does not own a counter.
* number: ONE counter shared by all prefixes = max(registered number, 238) + 1.
* postfix: last three digits of the Jalali year at registration (1405 -> ``405``).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select, text

from app.core.jalali import gregorian_to_jalali, to_persian_digits
from app.modules.correspondence.models import Correspondence

PREFIXES: tuple[str, ...] = ("ق", "خ", "ص", "د", "ن", "الف")
DEFAULT_PREFIX = "ق"
REGISTER_TYPE_INCOMING = 1  # وارده
REGISTER_TYPE_OUTGOING = 2  # صادره
NUMBER_FLOOR = 238  # first registered number is 239
# Tehran has no DST since 2022: fixed UTC+03:30 for Jalali day boundaries.
TEHRAN_OFFSET = timedelta(hours=3, minutes=30)
# Transaction-scoped Postgres advisory lock that serialises number allocation.
REGISTER_LOCK_KEY = 0x5EC7A1A


def format_letter_number(prefix: str, number: int, postfix: str) -> str:
    """Compose the display number with Persian digits, e.g. ``ق- ۲۳۷ -۴۰۵``."""
    return f"{prefix}- {to_persian_digits(number)} -{to_persian_digits(postfix)}"


def jalali_postfix(day: date) -> str:
    """Last three digits of the Jalali year of ``day`` (ASCII, zero padded)."""
    jy, _, _ = gregorian_to_jalali(day.year, day.month, day.day)
    return f"{jy % 1000:03d}"


def tehran_date(now_utc: datetime) -> date:
    """Calendar date in Tehran for an aware UTC instant."""
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=UTC)
    return (now_utc.astimezone(UTC) + TEHRAN_OFFSET).date()


def register_type_for(direction: str) -> int:
    """Letter direction to register type: outgoing = صادره, incoming = وارده."""
    return REGISTER_TYPE_OUTGOING if direction == "outgoing" else REGISTER_TYPE_INCOMING


def next_number(current_max: int | None) -> int:
    """Next company-wide number given the highest registered number (None if none yet)."""
    return max(current_max or 0, NUMBER_FLOOR) + 1


def letter_number_of(letter: Correspondence) -> str | None:
    """Composed display number, or None when the letter is not registered."""
    if letter.secretariat_number is None:
        return None
    return format_letter_number(
        letter.secretariat_prefix or "",
        letter.secretariat_number,
        letter.secretariat_postfix or "",
    )


async def _lock_counter(session) -> None:
    if session.get_bind().dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": REGISTER_LOCK_KEY})


async def register_letter(session, letter: Correspondence, prefix: str, now_utc: datetime) -> Correspondence:
    """Register ``letter`` in the secretariat. Idempotent: a registered letter is returned unchanged.

    The counter lock is taken before the letter state is re-read, so two concurrent
    calls for the same letter cannot both allocate a number.
    """
    if prefix not in PREFIXES:
        raise ValueError(f"unknown secretariat prefix: {prefix!r}")
    await _lock_counter(session)
    await session.refresh(letter, attribute_names=["secretariat_number"])
    if letter.secretariat_number is not None:
        return letter
    current_max = (await session.execute(select(func.max(Correspondence.secretariat_number)))).scalar()
    letter.secretariat_number = next_number(current_max)
    letter.secretariat_prefix = prefix
    letter.secretariat_postfix = jalali_postfix(tehran_date(now_utc))
    letter.secretariat_register_type = register_type_for(letter.direction)
    letter.secretariat_registered_at = now_utc
    await session.flush()
    return letter
