# DDC-CWICR-OE: DataDrivenConstruction - OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Mailbox letters (نامه‌ها): user-to-user threads inside the correspondence module.

A mailbox letter is one ``Correspondence`` row per message with ``sender_user_id`` set and
``project_id`` NULL. Each message has ``CorrespondenceLetterRecipient`` rows (sender, to, forward)
that decide who sees it. Read marks reuse ``CorrespondenceLetterRead``.

Access: sender, recipients and global admin only. Recipients must share a project with the caller
(same rule as team chat colleagues) unless the caller is admin.
"""

from __future__ import annotations

import html
import re
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.core.hidden_users import is_hidden_system_user, viewer_is_admin
from app.core.storage import contained_upload_candidates, module_uploads_dir
from app.modules.documents import object_store
from app.dependencies import (
    CurrentUserId,
    CurrentUserPayload,
    RequirePermission,
    SessionDep,
    verify_project_access,
)
from app.modules.correspondence.html_sanitize import plain_text_to_html, sanitize_html
from app.modules.correspondence.models import (
    Correspondence,
    CorrespondenceLabel,
    CorrespondenceLetterLabel,
    CorrespondenceLetterRead,
    CorrespondenceLetterRecipient,
)
from app.modules.correspondence.secretariat import (
    DEFAULT_PREFIX,
    letter_number_of,
    register_letter,
)

KIND_SENDER = "sender"
KIND_TO = "to"
KIND_FORWARD = "forward"
BOXES = ("inbox", "outbox", "paraph", "archived")
_TAG_RE = re.compile(r"<[^>]+>")

mailbox_router = APIRouter(tags=["correspondence"])


# ── schemas ────────────────────────────────────────────────────────────


class PersonOut(BaseModel):
    user_id: uuid.UUID
    name: str
    avatar_url: str | None = None


class LabelOut(BaseModel):
    id: uuid.UUID
    name: str


class LabelIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ComposeIn(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(default="", max_length=200_000)
    to_user_ids: list[uuid.UUID] = Field(..., min_length=1)
    label_ids: list[uuid.UUID] = Field(default_factory=list)
    project_id: uuid.UUID | None = None


class ReplyIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=200_000)


class ForwardIn(BaseModel):
    to_user_ids: list[uuid.UUID] = Field(..., min_length=1)
    note: str = Field(default="", max_length=5000)


class RegisterIn(BaseModel):
    prefix: Literal["ق", "خ", "ص", "د", "ن", "الف"] = DEFAULT_PREFIX


class RegisterOut(BaseModel):
    id: uuid.UUID
    letter_number: str
    register_type: int
    secretariat_registered_at: str


class MailboxItem(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    subject: str
    snippet: str
    sender_user_id: uuid.UUID | None
    sender_name: str
    sender_avatar_url: str | None = None
    recipients: list[PersonOut]
    sent_at: str
    unread: bool
    attachments_count: int
    direction: str
    reference_number: str
    letter_number: str | None = None
    register_type: int | None = None
    labels: list[LabelOut]


class MailboxPage(BaseModel):
    items: list[MailboxItem]
    total: int


class UnreadOut(BaseModel):
    count: int


class AttachmentOut(BaseModel):
    id: str
    name: str
    size: int | None = None
    download_url: str


class MessageOut(BaseModel):
    id: uuid.UUID
    sender_user_id: uuid.UUID | None
    sender_name: str
    sender_avatar_url: str | None = None
    recipients: list[PersonOut]
    body_html: str
    sent_at: str
    attachments: list[AttachmentOut]


class ThreadOut(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    subject: str
    reference_number: str
    letter_number: str | None = None
    register_type: int | None = None
    secretariat_registered_at: str | None = None
    letter_type: str
    registered_at: str
    labels: list[LabelOut]
    messages: list[MessageOut]


class LetterOut(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    subject: str
    reference_number: str
    sent_at: str


# ── helpers ────────────────────────────────────────────────────────────


def _as_uuid(value: Any) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _iso(dt: datetime | None) -> str:
    return dt.isoformat() if dt else ""


def _new_reference() -> str:
    return f"MB-{datetime.now(UTC):%Y}-{uuid.uuid4().hex[:8].upper()}"


def _snippet(body_html: str | None) -> str:
    text = html.unescape(_TAG_RE.sub(" ", body_html or ""))
    return " ".join(text.split())[:160]


async def _users(session, ids: set[uuid.UUID], *, active_only: bool = False) -> dict[uuid.UUID, tuple[str, str | None]]:
    from app.modules.users.models import User

    if not ids:
        return {}
    stmt = select(User).where(User.id.in_(ids))
    if active_only:
        stmt = stmt.where(User.is_active.is_(True))
    rows = (await session.execute(stmt)).scalars().all()
    return {u.id: (u.full_name or u.email or "", u.avatar_url) for u in rows}


async def shareable_user_ids(session, viewer: uuid.UUID, is_admin: bool) -> set[uuid.UUID] | None:
    """Users who may receive a letter from ``viewer``. ``None`` = no limit (admin).

    Same scope as ``TeamChatService.list_colleagues``: members or owners of a project the viewer
    belongs to or owns, active, hidden system users excluded. No row limit.
    """
    if is_admin:
        return None
    from app.modules.projects.models import Project
    from app.modules.teams.access import member_project_ids_subquery
    from app.modules.teams.models import Team, TeamMembership
    from app.modules.users.models import User

    scope = (
        (
            await session.execute(
                select(Project.id).where(
                    or_(
                        Project.id.in_(member_project_ids_subquery(viewer)),
                        Project.owner_id == viewer,
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    if not scope:
        return set()
    member_ids = (
        select(TeamMembership.user_id).join(Team, Team.id == TeamMembership.team_id).where(Team.project_id.in_(scope))
    )
    owner_ids = select(Project.owner_id).where(Project.id.in_(scope))
    rows = (
        await session.execute(
            select(User.id, User.email, User.full_name).where(
                User.is_active.is_(True),
                User.id != viewer,
                or_(User.id.in_(member_ids), User.id.in_(owner_ids)),
            )
        )
    ).all()
    return {r.id for r in rows if not is_hidden_system_user(r.email, r.full_name)}


async def validate_recipients(session, viewer: uuid.UUID, is_admin: bool, targets: list[uuid.UUID]) -> list[uuid.UUID]:
    targets = list(dict.fromkeys(targets))
    if viewer in targets:
        raise HTTPException(status_code=422, detail="Cannot address a letter to yourself")
    allowed = await shareable_user_ids(session, viewer, is_admin)
    if allowed is not None and any(t not in allowed for t in targets):
        raise HTTPException(status_code=403, detail="Recipient is outside your projects")
    found = await _users(session, set(targets), active_only=True)
    if len(found) != len(targets):
        raise HTTPException(status_code=422, detail="Unknown recipient")
    return targets


async def _validate_labels(session, label_ids: list[uuid.UUID]) -> list[uuid.UUID]:
    label_ids = list(dict.fromkeys(label_ids))
    if not label_ids:
        return []
    found = (
        (await session.execute(select(CorrespondenceLabel.id).where(CorrespondenceLabel.id.in_(label_ids))))
        .scalars()
        .all()
    )
    if len(set(found)) != len(label_ids):
        raise HTTPException(status_code=422, detail="Unknown label")
    return label_ids


async def load_mailbox_letter(session, letter_id: uuid.UUID) -> Correspondence:
    letter = await session.get(Correspondence, letter_id)
    if letter is None or letter.sender_user_id is None:
        raise HTTPException(status_code=404, detail="Letter not found")
    return letter


async def thread_access(session, thread_id: uuid.UUID, viewer: uuid.UUID, is_admin: bool) -> bool:
    """True when viewer has any participation row on any message of the thread (or is admin)."""
    if is_admin:
        return True
    stmt = (
        select(CorrespondenceLetterRecipient.id)
        .join(Correspondence, Correspondence.id == CorrespondenceLetterRecipient.letter_id)
        .where(Correspondence.thread_id == thread_id, CorrespondenceLetterRecipient.user_id == viewer)
        .limit(1)
    )
    return (await session.execute(stmt)).first() is not None


async def _require_thread(session, thread_id: uuid.UUID, viewer: uuid.UUID, is_admin: bool) -> None:
    if not await thread_access(session, thread_id, viewer, is_admin):
        raise HTTPException(status_code=404, detail="Letter not found")


async def _thread_participants(session, thread_id: uuid.UUID) -> set[uuid.UUID]:
    stmt = (
        select(CorrespondenceLetterRecipient.user_id)
        .join(Correspondence, Correspondence.id == CorrespondenceLetterRecipient.letter_id)
        .where(Correspondence.thread_id == thread_id)
    )
    return set((await session.execute(stmt)).scalars().all())


async def _add_message(
    session,
    *,
    sender: uuid.UUID,
    subject: str,
    body_html: str,
    thread_id: uuid.UUID | None,
    to_ids: list[uuid.UUID],
    kind: str = KIND_TO,
    note: str | None = None,
    label_ids: list[uuid.UUID] | None = None,
    project_id: uuid.UUID | None = None,
) -> Correspondence:
    letter_id = uuid.uuid4()
    letter = Correspondence(
        id=letter_id,
        project_id=None,
        reference_number=_new_reference(),
        direction="outgoing",
        subject=subject,
        correspondence_type="letter",
        sender_user_id=sender,
        thread_id=thread_id or letter_id,
        body_html=sanitize_html(body_html),
        created_by=str(sender),
        to_contact_ids=[],
        linked_document_ids=[],
        attachments=[],
        metadata_={"project_id": str(project_id)} if project_id else {},
    )
    session.add(letter)
    session.add(CorrespondenceLetterRecipient(letter_id=letter_id, user_id=sender, kind=KIND_SENDER))
    for target in to_ids:
        session.add(CorrespondenceLetterRecipient(letter_id=letter_id, user_id=target, kind=kind, note=note))
    for label_id in label_ids or []:
        session.add(CorrespondenceLetterLabel(letter_id=letter_id, label_id=label_id))
    await session.flush()
    return letter


async def compose_letter(
    session,
    viewer: uuid.UUID,
    is_admin: bool,
    data: ComposeIn,
) -> Correspondence:
    targets = await validate_recipients(session, viewer, is_admin, data.to_user_ids)
    labels = await _validate_labels(session, data.label_ids)
    return await _add_message(
        session,
        sender=viewer,
        subject=data.subject,
        body_html=data.body,
        thread_id=None,
        to_ids=targets,
        label_ids=labels,
        project_id=data.project_id,
    )


async def reply_letter(session, viewer: uuid.UUID, is_admin: bool, letter_id: uuid.UUID, body: str) -> Correspondence:
    root = await load_mailbox_letter(session, letter_id)
    await _require_thread(session, root.thread_id, viewer, is_admin)
    participants = await _thread_participants(session, root.thread_id)
    targets = sorted(p for p in participants if p != viewer)
    return await _add_message(
        session,
        sender=viewer,
        subject=root.subject,
        body_html=body,
        thread_id=root.thread_id,
        to_ids=targets,
    )


async def forward_letter(
    session, viewer: uuid.UUID, is_admin: bool, letter_id: uuid.UUID, to_user_ids: list[uuid.UUID], note: str
) -> Correspondence:
    root = await load_mailbox_letter(session, letter_id)
    await _require_thread(session, root.thread_id, viewer, is_admin)
    targets = await validate_recipients(session, viewer, is_admin, to_user_ids)
    return await _add_message(
        session,
        sender=viewer,
        subject=root.subject,
        body_html=plain_text_to_html(note),
        thread_id=root.thread_id,
        to_ids=targets,
        kind=KIND_FORWARD,
        note=note,
    )


async def mark_thread_read(session, thread_id: uuid.UUID, viewer: uuid.UUID) -> None:
    """Opening a thread marks every message the viewer participates in as read (idempotent)."""
    letter_ids = (
        (
            await session.execute(
                select(CorrespondenceLetterRecipient.letter_id)
                .join(Correspondence, Correspondence.id == CorrespondenceLetterRecipient.letter_id)
                .where(Correspondence.thread_id == thread_id, CorrespondenceLetterRecipient.user_id == viewer)
            )
        )
        .scalars()
        .all()
    )
    await mark_letters_read(session, list(letter_ids), viewer)


async def mark_letters_read(session, letter_ids: list[uuid.UUID], viewer: uuid.UUID) -> None:
    if not letter_ids:
        return
    existing = set(
        (
            await session.execute(
                select(CorrespondenceLetterRead.letter_id).where(
                    CorrespondenceLetterRead.letter_id.in_(letter_ids),
                    CorrespondenceLetterRead.user_id == viewer,
                )
            )
        )
        .scalars()
        .all()
    )
    for letter_id in letter_ids:
        if letter_id in existing:
            continue
        try:
            async with session.begin_nested():
                session.add(CorrespondenceLetterRead(letter_id=letter_id, user_id=viewer))
                await session.flush()
        except IntegrityError:
            pass


async def set_archived(session, thread_id: uuid.UUID, viewer: uuid.UUID, archived: bool) -> None:
    """Archive the viewer's incoming (to/forward) rows of a thread. Other recipients are untouched."""
    rows = (
        (
            await session.execute(
                select(CorrespondenceLetterRecipient)
                .join(Correspondence, Correspondence.id == CorrespondenceLetterRecipient.letter_id)
                .where(
                    Correspondence.thread_id == thread_id,
                    CorrespondenceLetterRecipient.user_id == viewer,
                    CorrespondenceLetterRecipient.kind.in_([KIND_TO, KIND_FORWARD]),
                )
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Letter not found")
    now = datetime.now(UTC)
    for row in rows:
        row.archived_at = now if archived else None
    await session.flush()


async def unread_count(session, viewer: uuid.UUID) -> int:
    """Incoming, non-archived messages the viewer has not opened yet."""
    incoming = (
        (
            await session.execute(
                select(CorrespondenceLetterRecipient.letter_id)
                .join(Correspondence, Correspondence.id == CorrespondenceLetterRecipient.letter_id)
                .where(
                    CorrespondenceLetterRecipient.user_id == viewer,
                    CorrespondenceLetterRecipient.kind.in_([KIND_TO, KIND_FORWARD]),
                    CorrespondenceLetterRecipient.archived_at.is_(None),
                    Correspondence.sender_user_id.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    if not incoming:
        return 0
    read = set(
        (
            await session.execute(
                select(CorrespondenceLetterRead.letter_id).where(
                    CorrespondenceLetterRead.letter_id.in_(incoming),
                    CorrespondenceLetterRead.user_id == viewer,
                )
            )
        )
        .scalars()
        .all()
    )
    return len(set(incoming) - read)


async def _labels_for(session, letter_ids: list[uuid.UUID], viewer: uuid.UUID) -> dict[uuid.UUID, list[LabelOut]]:
    out: dict[uuid.UUID, list[LabelOut]] = {}
    if not letter_ids:
        return out
    rows = (
        await session.execute(
            select(CorrespondenceLetterLabel.letter_id, CorrespondenceLabel.id, CorrespondenceLabel.name)
            .join(CorrespondenceLabel, CorrespondenceLabel.id == CorrespondenceLetterLabel.label_id)
            .where(
                CorrespondenceLetterLabel.letter_id.in_(letter_ids),
                CorrespondenceLabel.created_by == viewer,
            )
        )
    ).all()
    for letter_id, label_id, name in rows:
        out.setdefault(letter_id, []).append(LabelOut(id=label_id, name=name))
    return out


async def _recipient_rows(session, letter_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Any]]:
    out: dict[uuid.UUID, list[Any]] = {}
    if not letter_ids:
        return out
    rows = (
        (
            await session.execute(
                select(CorrespondenceLetterRecipient).where(
                    CorrespondenceLetterRecipient.letter_id.in_(letter_ids),
                    CorrespondenceLetterRecipient.kind.in_([KIND_TO, KIND_FORWARD]),
                )
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        out.setdefault(row.letter_id, []).append(row)
    return out


def _parse_date(value: date | None, end: bool = False) -> datetime | None:
    if value is None:
        return None
    base = datetime.combine(value, datetime.min.time(), tzinfo=UTC)
    return base + timedelta(days=1) if end else base


async def list_mailbox(
    session,
    viewer: uuid.UUID,
    *,
    box: str,
    label_id: uuid.UUID | None,
    q: str | None,
    unread: bool | None,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    offset: int,
) -> tuple[list[MailboxItem], int]:
    """One item per thread: the newest message the viewer can see in the chosen box.

    Grouping and paging happen in Python after the SQL filter (a thread may have several rows).
    """
    rec = CorrespondenceLetterRecipient
    stmt = (
        select(Correspondence, rec)
        .join(rec, rec.letter_id == Correspondence.id)
        .where(rec.user_id == viewer, Correspondence.sender_user_id.is_not(None))
    )
    if box == "inbox":
        stmt = stmt.where(rec.kind == KIND_TO, rec.archived_at.is_(None))
    elif box == "paraph":
        stmt = stmt.where(rec.kind == KIND_FORWARD, rec.archived_at.is_(None))
    elif box == "archived":
        stmt = stmt.where(rec.kind.in_([KIND_TO, KIND_FORWARD]), rec.archived_at.is_not(None))
    elif box == "outbox":
        stmt = stmt.where(rec.kind == KIND_SENDER)
    if q:
        needle = f"%{q}%"
        stmt = stmt.where(or_(Correspondence.subject.ilike(needle), Correspondence.body_html.ilike(needle)))
    if label_id is not None:
        stmt = stmt.where(
            Correspondence.id.in_(
                select(CorrespondenceLetterLabel.letter_id).where(CorrespondenceLetterLabel.label_id == label_id)
            )
        )
    start = _parse_date(date_from)
    end = _parse_date(date_to, end=True)
    if start is not None:
        stmt = stmt.where(Correspondence.created_at >= start)
    if end is not None:
        stmt = stmt.where(Correspondence.created_at < end)

    rows = (await session.execute(stmt)).all()
    read_ids = set(
        (
            await session.execute(
                select(CorrespondenceLetterRead.letter_id).where(CorrespondenceLetterRead.user_id == viewer)
            )
        )
        .scalars()
        .all()
    )
    threads: dict[uuid.UUID, dict[str, Any]] = {}
    for letter, row in rows:
        entry = threads.setdefault(letter.thread_id, {"latest": letter, "unread": False})
        if letter.created_at > entry["latest"].created_at:
            entry["latest"] = letter
        if row.kind in (KIND_TO, KIND_FORWARD) and letter.id not in read_ids:
            entry["unread"] = True
    selected = [t for t in threads.values() if unread is None or t["unread"] == unread]
    selected.sort(key=lambda t: t["latest"].created_at, reverse=True)
    total = len(selected)
    page = selected[offset : offset + limit]

    latest_ids = [t["latest"].id for t in page]
    recipients = await _recipient_rows(session, latest_ids)
    labels = await _labels_for(session, latest_ids, viewer)
    user_ids: set[uuid.UUID] = set()
    for letter in (t["latest"] for t in page):
        user_ids.add(letter.sender_user_id)
    for rows_ in recipients.values():
        user_ids.update(r.user_id for r in rows_)
    names = await _users(session, user_ids)

    items: list[MailboxItem] = []
    for t in page:
        letter: Correspondence = t["latest"]
        sender_name, sender_avatar = names.get(letter.sender_user_id, ("", None))
        items.append(
            MailboxItem(
                id=letter.id,
                thread_id=letter.thread_id,
                subject=letter.subject,
                snippet=_snippet(letter.body_html),
                sender_user_id=letter.sender_user_id,
                sender_name=sender_name,
                sender_avatar_url=sender_avatar,
                recipients=[
                    PersonOut(
                        user_id=r.user_id,
                        name=names.get(r.user_id, ("", None))[0],
                        avatar_url=names.get(r.user_id, ("", None))[1],
                    )
                    for r in recipients.get(letter.id, [])
                ],
                sent_at=_iso(letter.created_at),
                unread=t["unread"],
                attachments_count=len(letter.attachments or []),
                direction="outgoing" if letter.sender_user_id == viewer else "incoming",
                reference_number=letter.reference_number,
                letter_number=letter_number_of(letter),
                register_type=letter.secretariat_register_type,
                labels=labels.get(letter.id, []),
            )
        )
    return items, total


async def _attachment_size(path: str) -> int | None:
    """Byte size of a stored attachment: object store head for ``s3:`` paths, stat for local paths, None if gone."""
    if object_store.is_object_path(path):
        try:
            return await object_store.object_size(object_store.key_of(path))
        except Exception:
            return None
    for candidate in contained_upload_candidates(path, module_uploads_dir()):
        try:
            return candidate.stat().st_size
        except OSError:
            continue
    return None


async def build_thread(session, root: Correspondence, viewer: uuid.UUID, is_admin: bool) -> ThreadOut:
    await _require_thread(session, root.thread_id, viewer, is_admin)
    await mark_thread_read(session, root.thread_id, viewer)
    messages = (
        (
            await session.execute(
                select(Correspondence)
                .where(Correspondence.thread_id == root.thread_id, Correspondence.sender_user_id.is_not(None))
                .order_by(Correspondence.created_at, Correspondence.id)
            )
        )
        .scalars()
        .all()
    )
    ids = [m.id for m in messages]
    recipients = await _recipient_rows(session, ids)
    labels = await _labels_for(session, ids, viewer)
    user_ids = {m.sender_user_id for m in messages}
    for rows_ in recipients.values():
        user_ids.update(r.user_id for r in rows_)
    names = await _users(session, user_ids)

    out_messages: list[MessageOut] = []
    thread_labels: dict[uuid.UUID, LabelOut] = {}
    for m in messages:
        for label in labels.get(m.id, []):
            thread_labels[label.id] = label
        sender_name, sender_avatar = names.get(m.sender_user_id, ("", None))
        out_messages.append(
            MessageOut(
                id=m.id,
                sender_user_id=m.sender_user_id,
                sender_name=sender_name,
                sender_avatar_url=sender_avatar,
                recipients=[
                    PersonOut(
                        user_id=r.user_id,
                        name=names.get(r.user_id, ("", None))[0],
                        avatar_url=names.get(r.user_id, ("", None))[1],
                    )
                    for r in recipients.get(m.id, [])
                ],
                body_html=sanitize_html(m.body_html),
                sent_at=_iso(m.created_at),
                attachments=[
                    AttachmentOut(
                        id=str(i),
                        name=Path(str(p)).name,
                        size=await _attachment_size(str(p)),
                        download_url=f"/v1/correspondence/{m.id}/attachments/{i}",
                    )
                    for i, p in enumerate(m.attachments or [])
                ],
            )
        )
    return ThreadOut(
        id=root.id,
        thread_id=root.thread_id,
        subject=root.subject,
        reference_number=root.reference_number,
        letter_number=letter_number_of(root),
        register_type=root.secretariat_register_type,
        secretariat_registered_at=_iso(root.secretariat_registered_at) or None,
        letter_type=root.correspondence_type,
        registered_at=_iso(root.created_at),
        labels=list(thread_labels.values()),
        messages=out_messages,
    )


async def _viewer_is_admin_db(session, viewer: uuid.UUID) -> bool:
    from app.modules.users.models import User

    role = (await session.execute(select(User.role).where(User.id == viewer))).scalar_one_or_none()
    return role == "admin"


def reject_mailbox_letter(letter: Correspondence) -> None:
    """Legacy project-register routes must not serve or change mailbox letters."""
    if letter.sender_user_id is not None:
        raise HTTPException(status_code=404, detail="Letter not found")


async def project_letter_access(session, letter: Correspondence, user_id: Any, verify: Any = None) -> None:
    verify = verify or verify_project_access
    """Legacy write routes (PATCH, DELETE): mailbox letters are 404, project rows keep project access."""
    reject_mailbox_letter(letter)
    await verify(letter.project_id, str(user_id), session)


async def upload_letter_access(session, letter: Correspondence, user_id: Any, verify: Any = None) -> None:
    verify = verify or verify_project_access
    """Attachment upload: mailbox letters accept files from the sender only."""
    viewer = _as_uuid(user_id)
    if letter.sender_user_id is not None:
        if letter.sender_user_id == viewer or await _viewer_is_admin_db(session, viewer):
            return
        raise HTTPException(status_code=403, detail="Only the sender can attach files")
    await verify(letter.project_id, str(user_id), session)


async def attachment_download_access(session, letter: Correspondence, user_id: Any, verify: Any = None) -> None:
    """Attachment download: mailbox letters need thread participation (sender, recipient or admin), else 403."""
    verify = verify or verify_project_access
    viewer = _as_uuid(user_id)
    if letter.sender_user_id is not None:
        if not await thread_access(session, letter.thread_id, viewer, await _viewer_is_admin_db(session, viewer)):
            raise HTTPException(status_code=403, detail="Access denied")
        return
    await verify(letter.project_id, str(user_id), session)


async def read_letter_access(session, letter: Correspondence, user_id: Any, verify: Any = None) -> None:
    verify = verify or verify_project_access
    """Read and download: mailbox letters need thread participation (or admin); project rows keep project access."""
    viewer = _as_uuid(user_id)
    if letter.sender_user_id is not None:
        await _require_thread(session, letter.thread_id, viewer, await _viewer_is_admin_db(session, viewer))
        return
    await verify(letter.project_id, str(user_id), session)


# ── routes ─────────────────────────────────────────────────────────────


@mailbox_router.get("/mailbox/", response_model=MailboxPage)
async def get_mailbox(
    session: SessionDep,
    user_id: CurrentUserId,
    payload: CurrentUserPayload,
    box: str = Query(default="inbox", pattern=r"^(inbox|outbox|paraph|archived)$"),
    label: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    unread: bool | None = Query(default=None),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _perm: None = Depends(RequirePermission("correspondence.read")),
) -> MailboxPage:
    items, total = await list_mailbox(
        session,
        _as_uuid(user_id),
        box=box,
        label_id=label,
        q=q,
        unread=unread,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return MailboxPage(items=items, total=total)


@mailbox_router.get("/mailbox/unread-count/", response_model=UnreadOut)
async def get_mailbox_unread(
    session: SessionDep,
    user_id: CurrentUserId,
    _perm: None = Depends(RequirePermission("correspondence.read")),
) -> UnreadOut:
    return UnreadOut(count=await unread_count(session, _as_uuid(user_id)))


@mailbox_router.get("/labels/", response_model=list[LabelOut])
async def list_labels(
    session: SessionDep,
    user_id: CurrentUserId,
    _perm: None = Depends(RequirePermission("correspondence.read")),
) -> list[LabelOut]:
    rows = (
        (
            await session.execute(
                select(CorrespondenceLabel)
                .where(CorrespondenceLabel.created_by == _as_uuid(user_id))
                .order_by(CorrespondenceLabel.name)
            )
        )
        .scalars()
        .all()
    )
    return [LabelOut(id=r.id, name=r.name) for r in rows]


@mailbox_router.post("/labels/", response_model=LabelOut, status_code=201)
async def create_label(
    data: LabelIn,
    session: SessionDep,
    user_id: CurrentUserId,
    _perm: None = Depends(RequirePermission("correspondence.create")),
) -> LabelOut:
    name = data.name.strip()
    existing = (
        await session.execute(
            select(CorrespondenceLabel).where(
                CorrespondenceLabel.name == name,
                CorrespondenceLabel.created_by == _as_uuid(user_id),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Label already exists")
    label = CorrespondenceLabel(name=name, created_by=_as_uuid(user_id))
    session.add(label)
    await session.flush()
    return LabelOut(id=label.id, name=label.name)


@mailbox_router.post("/{letter_id}/labels/{label_id}/", status_code=204)
async def attach_label(
    letter_id: uuid.UUID,
    label_id: uuid.UUID,
    session: SessionDep,
    user_id: CurrentUserId,
    _perm: None = Depends(RequirePermission("correspondence.create")),
) -> None:
    viewer = _as_uuid(user_id)
    letter = await _mailbox_letter_for_label(session, letter_id, viewer)
    label = await _own_label(session, label_id, viewer)
    link = (
        await session.execute(
            select(CorrespondenceLetterLabel).where(
                CorrespondenceLetterLabel.letter_id == letter.id,
                CorrespondenceLetterLabel.label_id == label.id,
            )
        )
    ).scalar_one_or_none()
    if link is None:
        session.add(CorrespondenceLetterLabel(letter_id=letter.id, label_id=label.id))
        await session.flush()


@mailbox_router.delete("/{letter_id}/labels/{label_id}/", status_code=204)
async def detach_label(
    letter_id: uuid.UUID,
    label_id: uuid.UUID,
    session: SessionDep,
    user_id: CurrentUserId,
    _perm: None = Depends(RequirePermission("correspondence.create")),
) -> None:
    viewer = _as_uuid(user_id)
    letter = await _mailbox_letter_for_label(session, letter_id, viewer)
    label = await _own_label(session, label_id, viewer)
    link = (
        await session.execute(
            select(CorrespondenceLetterLabel).where(
                CorrespondenceLetterLabel.letter_id == letter.id,
                CorrespondenceLetterLabel.label_id == label.id,
            )
        )
    ).scalar_one_or_none()
    if link is not None:
        await session.delete(link)
        await session.flush()


async def _mailbox_letter_for_label(session, letter_id: uuid.UUID, viewer: uuid.UUID) -> Correspondence:
    letter = (
        await session.execute(select(Correspondence).where(Correspondence.id == letter_id))
    ).scalar_one_or_none()
    if letter is None or letter.sender_user_id is None:
        raise HTTPException(status_code=404, detail="Letter not found")
    await _require_thread(session, letter.thread_id, viewer, await _viewer_is_admin_db(session, viewer))
    return letter


async def _own_label(session, label_id: uuid.UUID, viewer: uuid.UUID) -> CorrespondenceLabel:
    label = (
        await session.execute(
            select(CorrespondenceLabel).where(
                CorrespondenceLabel.id == label_id,
                CorrespondenceLabel.created_by == viewer,
            )
        )
    ).scalar_one_or_none()
    if label is None:
        raise HTTPException(status_code=404, detail="Label not found")
    return label


@mailbox_router.post("/compose/", response_model=LetterOut, status_code=201)
async def compose(
    data: ComposeIn,
    session: SessionDep,
    user_id: CurrentUserId,
    payload: CurrentUserPayload,
    _perm: None = Depends(RequirePermission("correspondence.create")),
) -> LetterOut:
    viewer = _as_uuid(user_id)
    if data.project_id is not None:
        # Only checks the caller may tag a project; the letter itself stays project-free (no leakage).
        await verify_project_access(data.project_id, str(viewer), session)
    letter = await compose_letter(session, viewer, viewer_is_admin(payload), data)
    return LetterOut(
        id=letter.id,
        thread_id=letter.thread_id,
        subject=letter.subject,
        reference_number=letter.reference_number,
        sent_at=_iso(letter.created_at),
    )


@mailbox_router.get("/{letter_id}/thread/", response_model=ThreadOut)
async def get_thread(
    letter_id: uuid.UUID,
    session: SessionDep,
    user_id: CurrentUserId,
    payload: CurrentUserPayload,
    _perm: None = Depends(RequirePermission("correspondence.read")),
) -> ThreadOut:
    root = await load_mailbox_letter(session, letter_id)
    return await build_thread(session, root, _as_uuid(user_id), viewer_is_admin(payload))


@mailbox_router.post("/{letter_id}/reply/", response_model=LetterOut, status_code=201)
async def reply(
    letter_id: uuid.UUID,
    data: ReplyIn,
    session: SessionDep,
    user_id: CurrentUserId,
    payload: CurrentUserPayload,
    _perm: None = Depends(RequirePermission("correspondence.create")),
) -> LetterOut:
    letter = await reply_letter(session, _as_uuid(user_id), viewer_is_admin(payload), letter_id, data.body)
    return LetterOut(
        id=letter.id,
        thread_id=letter.thread_id,
        subject=letter.subject,
        reference_number=letter.reference_number,
        sent_at=_iso(letter.created_at),
    )


@mailbox_router.post("/{letter_id}/forward/", response_model=LetterOut, status_code=201)
async def forward(
    letter_id: uuid.UUID,
    data: ForwardIn,
    session: SessionDep,
    user_id: CurrentUserId,
    payload: CurrentUserPayload,
    _perm: None = Depends(RequirePermission("correspondence.create")),
) -> LetterOut:
    letter = await forward_letter(
        session, _as_uuid(user_id), viewer_is_admin(payload), letter_id, data.to_user_ids, data.note
    )
    return LetterOut(
        id=letter.id,
        thread_id=letter.thread_id,
        subject=letter.subject,
        reference_number=letter.reference_number,
        sent_at=_iso(letter.created_at),
    )


@mailbox_router.post("/{letter_id}/register/", response_model=RegisterOut)
async def register(
    letter_id: uuid.UUID,
    session: SessionDep,
    user_id: CurrentUserId,
    payload: CurrentUserPayload,
    data: RegisterIn = RegisterIn(),
    _perm: None = Depends(RequirePermission("correspondence.create")),
) -> RegisterOut:
    viewer = _as_uuid(user_id)
    root = await load_mailbox_letter(session, letter_id)
    await _require_thread(session, root.thread_id, viewer, viewer_is_admin(payload))
    letter = await register_letter(session, root, data.prefix, datetime.now(UTC))
    return RegisterOut(
        id=letter.id,
        letter_number=letter_number_of(letter) or "",
        register_type=letter.secretariat_register_type or 0,
        secretariat_registered_at=_iso(letter.secretariat_registered_at),
    )


@mailbox_router.post("/{letter_id}/archive/", status_code=204)
async def archive(
    letter_id: uuid.UUID,
    session: SessionDep,
    user_id: CurrentUserId,
    _perm: None = Depends(RequirePermission("correspondence.read")),
) -> None:
    root = await load_mailbox_letter(session, letter_id)
    await set_archived(session, root.thread_id, _as_uuid(user_id), archived=True)


@mailbox_router.post("/{letter_id}/unarchive/", status_code=204)
async def unarchive(
    letter_id: uuid.UUID,
    session: SessionDep,
    user_id: CurrentUserId,
    _perm: None = Depends(RequirePermission("correspondence.read")),
) -> None:
    root = await load_mailbox_letter(session, letter_id)
    await set_archived(session, root.thread_id, _as_uuid(user_id), archived=False)


__all__ = [
    "mailbox_router",
    "project_letter_access",
    "read_letter_access",
    "attachment_download_access",
    "reject_mailbox_letter",
    "upload_letter_access",
]
