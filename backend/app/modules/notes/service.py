# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Personal notes service. Every query is scoped to ``owner_user_id``; a note owned by someone else reads as 404."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.models import UserNote
from app.modules.notes.schemas import NoteCreate, NotePatch


def _owner(user_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(user_id))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid user") from exc


async def list_notes(session: AsyncSession, user_id: str) -> list[UserNote]:
    stmt = (
        select(UserNote)
        .where(UserNote.owner_user_id == _owner(user_id))
        .order_by(UserNote.pinned.desc(), UserNote.updated_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def _get_owned(session: AsyncSession, user_id: str, note_id: uuid.UUID) -> UserNote:
    stmt = select(UserNote).where(UserNote.id == note_id, UserNote.owner_user_id == _owner(user_id))
    note = (await session.execute(stmt)).scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


async def create_note(session: AsyncSession, user_id: str, data: NoteCreate) -> UserNote:
    now = datetime.now(UTC)
    note = UserNote(
        owner_user_id=_owner(user_id),
        title=data.title,
        body=data.body,
        color=data.color,
        pinned=data.pinned,
        created_at=now,
        updated_at=now,
    )
    session.add(note)
    await session.flush()
    await session.refresh(note)
    return note


async def update_note(session: AsyncSession, user_id: str, note_id: uuid.UUID, data: NotePatch) -> UserNote:
    note = await _get_owned(session, user_id, note_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(note, field, value)
    note.updated_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(note)
    return note


async def delete_note(session: AsyncSession, user_id: str, note_id: uuid.UUID) -> None:
    note = await _get_owned(session, user_id, note_id)
    await session.delete(note)
    await session.flush()
