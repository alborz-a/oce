# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Secretariat registration: number format, counter floor, sequence, Jalali postfix, idempotency."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.jalali import gregorian_to_jalali
from app.modules.correspondence.models import Correspondence
from app.modules.correspondence.secretariat import (
    NUMBER_FLOOR,
    REGISTER_TYPE_INCOMING,
    REGISTER_TYPE_OUTGOING,
    format_letter_number,
    jalali_postfix,
    letter_number_of,
    next_number,
    register_letter,
    register_type_for,
    tehran_date,
)


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Correspondence.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


def _letter(direction: str = "outgoing") -> Correspondence:
    return Correspondence(
        id=uuid.uuid4(),
        project_id=None,
        reference_number=f"MB-2026-{uuid.uuid4().hex[:8].upper()}",
        direction=direction,
        subject="s",
        correspondence_type="letter",
        to_contact_ids=[],
        linked_document_ids=[],
        attachments=[],
        metadata_={},
    )


# ── pure helpers ───────────────────────────────────────────────────────


def test_format_uses_persian_digits_and_spacing():
    assert format_letter_number("ق", 237, "405") == "ق- ۲۳۷ -۴۰۵"
    assert format_letter_number("خ", 1, "404") == "خ- ۱ -۴۰۴"
    assert format_letter_number("الف", 300, "405") == "الف- ۳۰۰ -۴۰۵"


def test_boundary_dates_premise():
    assert gregorian_to_jalali(2026, 3, 20) == (1404, 12, 29)
    assert gregorian_to_jalali(2026, 3, 21) == (1405, 1, 1)


def test_jalali_postfix_at_year_boundary():
    assert jalali_postfix(date(2026, 3, 21)) == "405"  # 1405-01-01
    assert jalali_postfix(date(2026, 3, 20)) == "404"  # 1404-12-29
    assert jalali_postfix(date(2026, 7, 16)) == "405"  # 1405-04-25


def test_tehran_day_boundary_uses_utc_plus_0330():
    # 20:30 UTC on 20 March = 00:00 on 21 March in Tehran (new Jalali year).
    assert tehran_date(datetime(2026, 3, 20, 20, 30, tzinfo=UTC)) == date(2026, 3, 21)
    assert tehran_date(datetime(2026, 3, 20, 20, 29, tzinfo=UTC)) == date(2026, 3, 20)


def test_counter_floor_first_number_is_239():
    assert NUMBER_FLOOR == 238
    assert next_number(None) == 239
    assert next_number(0) == 239
    assert next_number(100) == 239
    assert next_number(238) == 239
    assert next_number(300) == 301


def test_register_type_from_direction():
    assert register_type_for("outgoing") == REGISTER_TYPE_OUTGOING == 2
    assert register_type_for("incoming") == REGISTER_TYPE_INCOMING == 1


def test_unregistered_letter_has_no_number():
    assert letter_number_of(_letter()) is None


# ── database behaviour (sqlite) ────────────────────────────────────────

NOW = datetime(2026, 7, 16, 9, 0, tzinfo=UTC)  # 1405-04-25 in Tehran


async def test_first_registration_is_239_with_postfix(session):
    letter = _letter()
    session.add(letter)
    await session.flush()
    await register_letter(session, letter, "ق", NOW)
    assert letter.secretariat_number == 239
    assert letter.secretariat_prefix == "ق"
    assert letter.secretariat_postfix == "405"
    assert letter.secretariat_register_type == REGISTER_TYPE_OUTGOING
    assert letter.secretariat_registered_at == NOW
    assert letter_number_of(letter) == "ق- ۲۳۹ -۴۰۵"


async def test_one_counter_shared_by_all_prefixes_is_unique(session):
    letters = [_letter() for _ in range(4)]
    session.add_all(letters)
    await session.flush()
    prefixes = ["ق", "خ", "ص", "الف"]
    for letter, prefix in zip(letters, prefixes, strict=True):
        await register_letter(session, letter, prefix, NOW)
    numbers = [letter.secretariat_number for letter in letters]
    assert numbers == [239, 240, 241, 242]
    assert len(set(numbers)) == len(numbers)


async def test_registration_continues_from_existing_max(session):
    old = _letter()
    old.secretariat_number = 300
    old.secretariat_prefix = "ق"
    old.secretariat_postfix = "404"
    session.add(old)
    await session.flush()
    fresh = _letter(direction="incoming")
    session.add(fresh)
    await session.flush()
    await register_letter(session, fresh, "خ", NOW)
    assert fresh.secretariat_number == 301
    assert fresh.secretariat_register_type == REGISTER_TYPE_INCOMING


async def test_registration_is_idempotent(session):
    letter = _letter()
    session.add(letter)
    await session.flush()
    await register_letter(session, letter, "ق", NOW)
    later = datetime(2026, 8, 1, 9, 0, tzinfo=UTC)
    await register_letter(session, letter, "ص", later)
    assert letter.secretariat_number == 239
    assert letter.secretariat_prefix == "ق"
    assert letter.secretariat_registered_at == NOW
    # The repeat call must not consume a number: the next letter gets 240.
    other = _letter()
    session.add(other)
    await session.flush()
    await register_letter(session, other, "ق", NOW)
    assert other.secretariat_number == 240


async def test_unknown_prefix_rejected(session):
    letter = _letter()
    session.add(letter)
    await session.flush()
    with pytest.raises(ValueError):
        await register_letter(session, letter, "X", NOW)
    assert letter.secretariat_number is None
