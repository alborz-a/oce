"""Personal notes: own-notes CRUD and owner isolation.

In-memory SQLite and service-level calls only (no network, no PostgreSQL), like tests/team_chat.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.modules.notes import service
from app.modules.notes.models import UserNote
from app.modules.notes.schemas import NoteCreate, NotePatch

ALICE = str(uuid.uuid4())
BOB = str(uuid.uuid4())


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(UserNote.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


async def test_create_then_list_returns_only_own_notes(session: AsyncSession):
    await service.create_note(session, ALICE, NoteCreate(title="a", body="x"))
    await service.create_note(session, BOB, NoteCreate(title="b"))
    await session.commit()

    alice_notes = await service.list_notes(session, ALICE)
    assert [n.title for n in alice_notes] == ["a"]
    assert alice_notes[0].color == "#fb0"
    assert alice_notes[0].pinned is False


async def test_list_orders_pinned_first_then_updated_desc(session: AsyncSession):
    plain = await service.create_note(session, ALICE, NoteCreate(title="plain"))
    pinned = await service.create_note(session, ALICE, NoteCreate(title="pinned", pinned=True))
    await session.commit()

    titles = [n.title for n in await service.list_notes(session, ALICE)]
    assert titles == ["pinned", "plain"]
    assert plain.id != pinned.id


async def test_update_own_note_changes_fields(session: AsyncSession):
    note = await service.create_note(session, ALICE, NoteCreate(title="old"))
    await session.commit()

    updated = await service.update_note(session, ALICE, note.id, NotePatch(title="new", pinned=True))
    await session.commit()

    assert updated.title == "new"
    assert updated.pinned is True


async def test_delete_own_note_removes_it(session: AsyncSession):
    note = await service.create_note(session, ALICE, NoteCreate(title="gone"))
    await session.commit()

    await service.delete_note(session, ALICE, note.id)
    await session.commit()

    assert await service.list_notes(session, ALICE) == []


async def test_cannot_read_update_or_delete_another_users_note(session: AsyncSession):
    note = await service.create_note(session, ALICE, NoteCreate(title="private"))
    await session.commit()

    with pytest.raises(HTTPException) as read_exc:
        await service.update_note(session, BOB, note.id, NotePatch(title="hacked"))
    assert read_exc.value.status_code == 404

    with pytest.raises(HTTPException) as delete_exc:
        await service.delete_note(session, BOB, note.id)
    assert delete_exc.value.status_code == 404

    # Bob sees nothing, and Alice's note is untouched.
    assert await service.list_notes(session, BOB) == []
    alice_notes = await service.list_notes(session, ALICE)
    assert [n.title for n in alice_notes] == ["private"]
