"""Mailbox letters (نامه‌ها): compose, reply, forward, boxes, unread, archive, labels, access.

In-memory SQLite, service and route functions called directly (no network, no PostgreSQL), like
``test_letter_unread.py``. Scope and user lookups are monkeypatched; the scope SQL itself is
``shareable_user_ids`` and is covered by the project-membership tests in ``tests/teams``.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.modules.correspondence import mailbox as mb
from app.modules.correspondence.models import (
    Correspondence,
    CorrespondenceLabel,
    CorrespondenceLetterLabel,
    CorrespondenceLetterRead,
    CorrespondenceLetterRecipient,
)
from app.modules.correspondence.service import CorrespondenceService

ALICE = uuid.uuid4()
BOB = uuid.uuid4()
CAROL = uuid.uuid4()  # shares a project with ALICE and BOB
DAVE = uuid.uuid4()  # no shared project with anyone
ADMIN = uuid.uuid4()

SCOPE = {ALICE: {BOB, CAROL}, BOB: {ALICE, CAROL}, CAROL: {ALICE, BOB}, DAVE: set()}


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        for table in (
            Correspondence.__table__,
            CorrespondenceLetterRead.__table__,
            CorrespondenceLetterRecipient.__table__,
            CorrespondenceLabel.__table__,
            CorrespondenceLetterLabel.__table__,
        ):
            await conn.run_sync(table.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


@pytest.fixture(autouse=True)
def stub_scope(monkeypatch):
    async def fake_scope(session, viewer, is_admin):
        return None if is_admin else SCOPE.get(viewer, set())

    async def fake_users(session, ids, *, active_only=False):
        return {u: (f"name-{str(u)[:4]}", None) for u in ids}

    async def fake_admin(session, viewer):
        return viewer == ADMIN

    monkeypatch.setattr(mb, "shareable_user_ids", fake_scope)
    monkeypatch.setattr(mb, "_users", fake_users)
    monkeypatch.setattr(mb, "_viewer_is_admin_db", fake_admin)


def _compose(session: AsyncSession, sender, to, subject="موضوع", body="متن", labels=None):
    return mb.compose_letter(
        session,
        sender,
        sender == ADMIN,
        mb.ComposeIn(subject=subject, body=body, to_user_ids=to, label_ids=labels or []),
    )


async def _box(session, user, box, *, label=None, q=None, unread=None, date_from=None, date_to=None):
    return await mb.list_mailbox(
        session,
        user,
        box=box,
        label_id=label,
        q=q,
        unread=unread,
        date_from=date_from,
        date_to=date_to,
        limit=50,
        offset=0,
    )


async def test_compose_sets_inbox_outbox_and_unread(session):
    letter = await _compose(session, ALICE, [BOB])
    await session.commit()

    items, total = await _box(session, BOB, "inbox")
    assert total == 1 and items[0].id == letter.id
    assert items[0].unread is True
    assert items[0].direction == "incoming"
    assert items[0].reference_number.startswith("MB-")
    assert items[0].sender_user_id == ALICE

    out_items, out_total = await _box(session, ALICE, "outbox")
    assert out_total == 1 and out_items[0].direction == "outgoing"

    assert await mb.unread_count(session, BOB) == 1
    assert await mb.unread_count(session, ALICE) == 0


async def test_compose_rejects_outside_scope_self_and_unknown_label(session):
    with pytest.raises(HTTPException) as denied:
        await _compose(session, ALICE, [DAVE])
    assert denied.value.status_code == 403

    with pytest.raises(HTTPException) as self_send:
        await _compose(session, ALICE, [ALICE])
    assert self_send.value.status_code == 422

    with pytest.raises(HTTPException) as bad_label:
        await _compose(session, ALICE, [BOB], labels=[uuid.uuid4()])
    assert bad_label.value.status_code == 422


async def test_admin_can_address_anyone(session):
    letter = await _compose(session, ADMIN, [DAVE])
    await session.commit()
    items, total = await _box(session, DAVE, "inbox")
    assert total == 1 and items[0].id == letter.id


async def test_thread_open_marks_read_and_reply_reaches_sender(session):
    letter = await _compose(session, ALICE, [BOB])
    await session.commit()

    thread = await mb.build_thread(session, letter, BOB, is_admin=False)
    assert len(thread.messages) == 1
    assert await mb.unread_count(session, BOB) == 0
    items, _ = await _box(session, BOB, "inbox")
    assert items[0].unread is False

    reply = await mb.reply_letter(session, BOB, False, letter.id, "پاسخ")
    await session.commit()
    assert reply.thread_id == letter.thread_id

    alice_items, alice_total = await _box(session, ALICE, "inbox")
    assert alice_total == 1 and alice_items[0].unread is True
    assert await mb.unread_count(session, ALICE) == 1
    thread_after = await mb.build_thread(session, letter, ALICE, is_admin=False)
    assert len(thread_after.messages) == 2
    assert await mb.unread_count(session, ALICE) == 0


async def test_forward_goes_to_paraph_box_with_note(session):
    letter = await _compose(session, ALICE, [BOB])
    await session.commit()

    await mb.forward_letter(session, BOB, False, letter.id, [CAROL], "لطفا بررسی شود")
    await session.commit()

    paraph, paraph_total = await _box(session, CAROL, "paraph")
    assert paraph_total == 1 and paraph[0].unread is True
    inbox, inbox_total = await _box(session, CAROL, "inbox")
    assert inbox_total == 0
    assert await mb.unread_count(session, CAROL) == 1

    with pytest.raises(HTTPException) as denied:
        await mb.forward_letter(session, BOB, False, letter.id, [DAVE], "x")
    assert denied.value.status_code == 403


async def test_archive_only_affects_caller_and_unarchive_restores(session):
    letter = await _compose(session, ALICE, [BOB])
    await session.commit()

    await mb.set_archived(session, letter.thread_id, BOB, archived=True)
    await session.commit()
    assert (await _box(session, BOB, "inbox"))[1] == 0
    assert (await _box(session, BOB, "archived"))[1] == 1
    assert (await _box(session, ALICE, "outbox"))[1] == 1
    assert await mb.unread_count(session, BOB) == 0

    await mb.set_archived(session, letter.thread_id, BOB, archived=False)
    await session.commit()
    assert (await _box(session, BOB, "inbox"))[1] == 1

    with pytest.raises(HTTPException) as no_rows:
        await mb.set_archived(session, letter.thread_id, DAVE, archived=True)
    assert no_rows.value.status_code == 404


async def test_access_denied_for_non_participant(session):
    letter = await _compose(session, ALICE, [BOB])
    await session.commit()

    # CAROL shares a project with the sender but is not a participant of this letter.
    assert (await _box(session, CAROL, "inbox"))[1] == 0
    with pytest.raises(HTTPException) as thread_denied:
        await mb.build_thread(session, letter, CAROL, is_admin=False)
    assert thread_denied.value.status_code == 404

    with pytest.raises(HTTPException) as reply_denied:
        await mb.reply_letter(session, DAVE, False, letter.id, "x")
    assert reply_denied.value.status_code == 404

    # Attachments: sender only for upload; any participant for read/download.
    with pytest.raises(HTTPException) as upload_denied:
        await mb.upload_letter_access(session, letter, BOB)
    assert upload_denied.value.status_code == 404
    await mb.upload_letter_access(session, letter, ALICE)

    with pytest.raises(HTTPException) as read_denied:
        await mb.read_letter_access(session, letter, DAVE)
    assert read_denied.value.status_code == 404
    await mb.read_letter_access(session, letter, BOB)

    # Legacy project-register routes never serve mailbox letters.
    with pytest.raises(HTTPException) as legacy:
        mb.reject_mailbox_letter(letter)
    assert legacy.value.status_code == 404
    with pytest.raises(HTTPException) as legacy_write:
        await mb.project_letter_access(session, letter, ALICE)
    assert legacy_write.value.status_code == 404


async def test_admin_reads_any_thread(session):
    letter = await _compose(session, ALICE, [BOB])
    await session.commit()
    thread = await mb.build_thread(session, letter, ADMIN, is_admin=True)
    assert len(thread.messages) == 1
    await mb.read_letter_access(session, letter, ADMIN)


async def test_legacy_unread_count_excludes_mailbox_letters(session):
    await _compose(session, ALICE, [BOB])
    await session.commit()
    assert await CorrespondenceService(session).unread_letter_count(BOB, None) == 0


async def test_unread_filter_search_and_date_range(session):
    await _compose(session, ALICE, [BOB], subject="فاکتور مهم", body="جزئیات")
    await session.commit()

    unread_items, unread_total = await _box(session, BOB, "inbox", unread=True)
    assert unread_total == 1
    assert (await _box(session, BOB, "inbox", q="فاکتور"))[1] == 1
    assert (await _box(session, BOB, "inbox", q="ناموجود"))[1] == 0

    today = date.today()
    assert (await _box(session, BOB, "inbox", date_from=today, date_to=today))[1] == 1
    assert (await _box(session, BOB, "inbox", date_from=date(2000, 1, 1), date_to=date(2000, 1, 2)))[1] == 0
    assert unread_items[0].snippet


async def test_labels_filter_and_duplicate_name(session):
    label = CorrespondenceLabel(name="مهم")
    session.add(label)
    await session.flush()
    await _compose(session, ALICE, [BOB], labels=[label.id])
    await _compose(session, ALICE, [BOB], subject="دیگر")
    await session.commit()

    items, total = await _box(session, BOB, "inbox", label=label.id)
    assert total == 1 and items[0].labels[0].name == "مهم"

    created = await mb.create_label(mb.LabelIn(name="برچسب"), session, str(ALICE), None)
    assert created.name == "برچسب"
    with pytest.raises(HTTPException) as dup:
        await mb.create_label(mb.LabelIn(name="برچسب"), session, str(ALICE), None)
    assert dup.value.status_code == 409


async def test_read_mark_is_idempotent(session):
    letter = await _compose(session, ALICE, [BOB])
    await session.commit()
    await mb.mark_letters_read(session, [letter.id], BOB)
    await mb.mark_letters_read(session, [letter.id], BOB)
    await session.commit()
    assert await mb.unread_count(session, BOB) == 0
