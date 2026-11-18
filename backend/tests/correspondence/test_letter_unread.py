"""Correspondence per-user unread count and read marks.

In-memory SQLite and router/service-level calls only (no network, no PostgreSQL), like tests/notes.
Project access is stubbed: ``accessible_project_ids`` and ``verify_project_access`` are monkeypatched in the router.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.modules.correspondence import router as corr_router
from app.modules.correspondence.models import Correspondence, CorrespondenceLetterRead
from app.modules.correspondence.service import CorrespondenceService

ALICE = uuid.uuid4()  # sender
BOB = uuid.uuid4()  # recipient, project member
CAROL = uuid.uuid4()  # no access to the project
PROJECT = uuid.uuid4()


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Correspondence.__table__.create)
        await conn.run_sync(CorrespondenceLetterRead.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


@pytest.fixture
def member_projects(monkeypatch):
    """Caller project set: BOB and ALICE are members of PROJECT, CAROL is not."""

    async def fake_accessible(session, user_id, **kwargs):
        return {PROJECT} if user_id in (str(ALICE), str(BOB)) else set()

    async def fake_verify(project_id, user_id, session, **kwargs):
        if user_id != str(CAROL):
            return
        raise HTTPException(status_code=404, detail="Project not found")

    async def fake_general(session, project_id):
        return False

    monkeypatch.setattr(corr_router, "accessible_project_ids", fake_accessible)
    monkeypatch.setattr(corr_router, "verify_project_access", fake_verify)
    monkeypatch.setattr(corr_router, "_is_general_project", fake_general)


async def _add_letter(session: AsyncSession, sent_by: uuid.UUID, ref: str) -> Correspondence:
    letter = Correspondence(
        project_id=PROJECT,
        reference_number=ref,
        direction="incoming",
        subject=f"subject {ref}",
        correspondence_type="letter",
        created_by=str(sent_by),
    )
    session.add(letter)
    await session.commit()
    return letter


async def test_recipient_sees_count_one_then_zero_after_open(session, member_projects):
    letter = await _add_letter(session, ALICE, "COR-001")
    svc = CorrespondenceService(session)

    before = await corr_router.get_unread_count(session=session, user_id=str(BOB), service=svc)
    assert before.count == 1

    await corr_router.get_correspondence(
        correspondence_id=letter.id, session=session, user_id=str(BOB), service=svc
    )
    await session.commit()

    after = await corr_router.get_unread_count(session=session, user_id=str(BOB), service=svc)
    assert after.count == 0


async def test_sender_count_is_zero(session, member_projects):
    await _add_letter(session, ALICE, "COR-002")
    svc = CorrespondenceService(session)

    sender = await corr_router.get_unread_count(session=session, user_id=str(ALICE), service=svc)
    assert sender.count == 0


async def test_mark_read_is_idempotent(session, member_projects):
    letter = await _add_letter(session, ALICE, "COR-003")
    svc = CorrespondenceService(session)

    await corr_router.mark_correspondence_read(
        correspondence_id=letter.id, session=session, user_id=str(BOB), service=svc
    )
    await corr_router.mark_correspondence_read(
        correspondence_id=letter.id, session=session, user_id=str(BOB), service=svc
    )
    await session.commit()

    rows = (await session.execute(select(CorrespondenceLetterRead))).scalars().all()
    assert len(rows) == 1


async def test_user_without_project_access_cannot_mark_read(session, member_projects):
    letter = await _add_letter(session, ALICE, "COR-004")
    svc = CorrespondenceService(session)

    with pytest.raises(HTTPException) as exc:
        await corr_router.mark_correspondence_read(
            correspondence_id=letter.id, session=session, user_id=str(CAROL), service=svc
        )
    assert exc.value.status_code == 404

    await session.commit()
    rows = (await session.execute(select(CorrespondenceLetterRead))).scalars().all()
    assert rows == []

    # CAROL's count is also zero: no project access, so the letter is not counted.
    carol = await corr_router.get_unread_count(session=session, user_id=str(CAROL), service=svc)
    assert carol.count == 0
