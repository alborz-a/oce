# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Team chat business logic: rooms, access rules, messages, read state, bulk import."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import accessible_project_ids, verify_project_access
from app.modules.team_chat.hub import chat_hub
from app.modules.team_chat.models import ChatMember, ChatMessage, ChatRoom
from app.modules.team_chat.schemas import MAX_TEXT, ImportRequest, ImportResult

logger = logging.getLogger(__name__)

COMPANY_NAME = "شرکت"
GENERAL_PROJECT_CODE = "MZ-GENERAL"
MAX_PAGE = 100


def _uuid(v: Any) -> uuid.UUID:
    return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))


def _not_found() -> HTTPException:
    # 404 (not 403) keeps room existence from leaking, like every project route.
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")


class TeamChatService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── users ──────────────────────────────────────────────────────────
    async def _user(self, user_id: uuid.UUID):
        from app.modules.users.models import User

        return await self.session.get(User, user_id)

    async def _is_admin(self, user_id: uuid.UUID) -> bool:
        u = await self._user(user_id)
        return bool(u is not None and getattr(u, "role", "") == "admin")

    async def _role(self, user_id: uuid.UUID) -> str:
        u = await self._user(user_id)
        return str(getattr(u, "role", "viewer")) if u is not None else "viewer"

    async def _names(self, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
        if not ids:
            return {}
        from app.modules.users.models import User

        rows = (await self.session.execute(select(User.id, User.full_name, User.email).where(User.id.in_(ids)))).all()
        return {r[0]: (r[1] or (r[2] or "").split("@")[0]) for r in rows}

    # ── rooms ──────────────────────────────────────────────────────────
    async def company_room(self) -> ChatRoom:
        room = (await self.session.execute(select(ChatRoom).where(ChatRoom.kind == "company"))).scalars().first()
        if room is None:
            room = ChatRoom(kind="company", name=COMPANY_NAME, created_by="")
            self.session.add(room)
            await self.session.flush()
        return room

    async def get_room(self, room_id: uuid.UUID) -> ChatRoom:
        room = await self.session.get(ChatRoom, room_id)
        if room is None:
            raise _not_found()
        return room

    async def can_access(self, room: ChatRoom, user_id: uuid.UUID) -> bool:
        if room.kind == "company":
            return True
        if room.kind == "project":
            try:
                await verify_project_access(room.project_id, str(user_id), self.session)
            except HTTPException:
                return False
            return True
        return await self._is_member(room.id, user_id)

    async def require_access(self, room_id: uuid.UUID, user_id: uuid.UUID) -> ChatRoom:
        room = await self.get_room(room_id)
        if not await self.can_access(room, user_id):
            raise _not_found()
        return room

    async def _is_member(self, room_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        q = select(ChatMember.id).where(ChatMember.room_id == room_id, ChatMember.user_id == user_id)
        return (await self.session.execute(q)).first() is not None

    async def _ensure_member(self, room_id: uuid.UUID, user_id: uuid.UUID, role: str = "member") -> ChatMember:
        q = select(ChatMember).where(ChatMember.room_id == room_id, ChatMember.user_id == user_id)
        m = (await self.session.execute(q)).scalars().first()
        if m is None:
            m = ChatMember(room_id=room_id, user_id=user_id, role=role)
            self.session.add(m)
            await self.session.flush()
        return m

    async def project_room(self, project_id: uuid.UUID, user_id: uuid.UUID) -> ChatRoom:
        await verify_project_access(project_id, str(user_id), self.session)
        return await self._get_or_create_project_room(project_id, user_id)

    async def _get_or_create_project_room(self, project_id: uuid.UUID, user_id: uuid.UUID | None) -> ChatRoom:
        room = (await self.session.execute(select(ChatRoom).where(ChatRoom.project_id == project_id))).scalars().first()
        if room is None:
            from app.modules.projects.models import Project

            project = await self.session.get(Project, project_id)
            name = getattr(project, "name", "") or ""
            room = ChatRoom(kind="project", project_id=project_id, name=name, created_by=str(user_id or ""))
            self.session.add(room)
            await self.session.flush()
        return room

    async def create_room(self, kind: str, name: str, member_ids: list[uuid.UUID], user_id: uuid.UUID) -> ChatRoom:
        ids = list(dict.fromkeys(member_ids))
        role = await self._role(user_id)
        if user_id not in ids:
            if role not in ("manager", "admin"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You must be a member of the room")
            if kind == "dm":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A DM must include you")
        if kind == "dm":
            if len(ids) != 2:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A DM needs exactly two users")
            return await self._get_or_create_dm(ids, str(user_id))
        if not name.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A group needs a name")
        room = ChatRoom(kind="group", name=name.strip(), created_by=str(user_id))
        self.session.add(room)
        await self.session.flush()
        for uid in ids:
            await self._ensure_member(room.id, uid, "owner" if uid == user_id else "member")
        return room

    async def _get_or_create_dm(self, ids: list[uuid.UUID], created_by: str) -> ChatRoom:
        key = ":".join(sorted(str(i) for i in ids))
        room = (await self.session.execute(select(ChatRoom).where(ChatRoom.dm_key == key))).scalars().first()
        if room is None:
            room = ChatRoom(kind="dm", name="", dm_key=key, created_by=created_by)
            self.session.add(room)
            await self.session.flush()
            for uid in ids:
                await self._ensure_member(room.id, uid)
        return room

    async def list_rooms(self, user_id: uuid.UUID) -> list[dict[str, Any]]:
        company = await self.company_room()
        proj_ids = await accessible_project_ids(self.session, str(user_id))
        pq = select(ChatRoom).where(ChatRoom.kind == "project")
        if proj_ids is not None:
            pq = pq.where(ChatRoom.project_id.in_(proj_ids or {uuid.UUID(int=0)}))
        projects = list((await self.session.execute(pq)).scalars())
        mq = (
            select(ChatRoom)
            .join(ChatMember, ChatMember.room_id == ChatRoom.id)
            .where(ChatMember.user_id == user_id, ChatRoom.kind.in_(("group", "dm")))
        )
        others = list((await self.session.execute(mq)).scalars())
        rooms = [company, *projects, *others]
        reads = {
            m.room_id: m.last_read_at
            for m in (await self.session.execute(select(ChatMember).where(ChatMember.user_id == user_id))).scalars()
        }
        out: list[dict[str, Any]] = []
        dm_other: dict[uuid.UUID, list[uuid.UUID]] = {}
        for r in others:
            if r.kind == "dm":
                dm_other[r.id] = [
                    m.user_id
                    for m in (
                        await self.session.execute(select(ChatMember).where(ChatMember.room_id == r.id))
                    ).scalars()
                    if m.user_id != user_id
                ]
        names = await self._names({u for v in dm_other.values() for u in v})
        for r in rooms:
            conds = [ChatMessage.room_id == r.id, or_(ChatMessage.author_id.is_(None), ChatMessage.author_id != user_id)]
            if reads.get(r.id) is not None:
                conds.append(ChatMessage.created_at > reads[r.id])
            unread = (await self.session.execute(select(func.count(ChatMessage.id)).where(and_(*conds)))).scalar() or 0
            last = (
                await self.session.execute(select(func.max(ChatMessage.created_at)).where(ChatMessage.room_id == r.id))
            ).scalar()
            name = r.name
            if r.kind == "dm":
                name = "، ".join(names.get(u, "") for u in dm_other.get(r.id, [])) or r.name
            out.append({"id": r.id, "kind": r.kind, "name": name, "project_id": r.project_id, "unread": int(unread),
                        "last_message_at": last})
        return out

    # ── messages ───────────────────────────────────────────────────────
    async def _serialize(self, msgs: list[ChatMessage]) -> list[dict[str, Any]]:
        names = await self._names({m.author_id for m in msgs if m.author_id})
        out = []
        for m in msgs:
            meta = dict(m.metadata_ or {})
            out.append({
                "id": m.id, "room_id": m.room_id, "author_id": m.author_id,
                "author_name": names.get(m.author_id) or str(meta.get("author_name") or ""),
                "text": m.text, "reply_to_id": m.reply_to_id,
                "document_ids": [_uuid(d) for d in (m.document_ids or [])],
                "created_at": m.created_at, "edited_at": m.edited_at, "metadata": meta,
            })
        return out

    async def list_messages(self, room_id: uuid.UUID, user_id: uuid.UUID, before: uuid.UUID | None, limit: int) -> list[dict]:
        await self.require_access(room_id, user_id)
        limit = max(1, min(limit, MAX_PAGE))
        q = select(ChatMessage).where(ChatMessage.room_id == room_id)
        if before is not None:
            ref = await self.session.get(ChatMessage, before)
            if ref is not None and ref.room_id == room_id:
                q = q.where(or_(ChatMessage.created_at < ref.created_at,
                                and_(ChatMessage.created_at == ref.created_at, ChatMessage.id < ref.id)))
        q = q.order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(limit)
        rows = list((await self.session.execute(q)).scalars())
        rows.reverse()
        return await self._serialize(rows)

    async def _allowed_document_projects(self, room: ChatRoom) -> set[uuid.UUID]:
        if room.kind == "project" and room.project_id is not None:
            return {room.project_id}
        from app.modules.projects.models import Project

        q = select(Project.id).where(Project.project_code == GENERAL_PROJECT_CODE)
        return {r[0] for r in (await self.session.execute(q)).all()}

    async def _check_documents(self, room: ChatRoom, document_ids: list[uuid.UUID], *, any_project: bool) -> None:
        if not document_ids:
            return
        from app.modules.documents.models import Document

        rows = (await self.session.execute(select(Document.id, Document.project_id).where(Document.id.in_(document_ids)))).all()
        found = {r[0]: r[1] for r in rows}
        if set(document_ids) - set(found):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown document")
        if any_project:
            return
        allowed = await self._allowed_document_projects(room)
        if any(p not in allowed for p in found.values()):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document is not in this room's project")

    async def post_message(self, room_id: uuid.UUID, user_id: uuid.UUID, text: str, reply_to_id: uuid.UUID | None,
                           document_ids: list[uuid.UUID], mentions: list[uuid.UUID]) -> dict[str, Any]:
        room = await self.require_access(room_id, user_id)
        text = (text or "").strip()
        if not text and not document_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty message")
        if len(text) > MAX_TEXT:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message too long")
        if reply_to_id is not None:
            ref = await self.session.get(ChatMessage, reply_to_id)
            if ref is None or ref.room_id != room_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reply target not in this room")
        await self._check_documents(room, document_ids, any_project=False)
        msg = ChatMessage(room_id=room_id, author_id=user_id, text=text, reply_to_id=reply_to_id,
                          document_ids=[str(d) for d in document_ids])
        self.session.add(msg)
        await self.session.flush()
        member = await self._ensure_member(room_id, user_id)
        member.last_read_at = datetime.now(UTC)
        data = (await self._serialize([msg]))[0]
        await chat_hub.broadcast(room_id, {"event": "message.created", "message": _jsonable(data)})
        await self._notify(room, user_id, data, mentions)
        return data

    async def _notify(self, room: ChatRoom, sender: uuid.UUID, data: dict, mentions: list[uuid.UUID]) -> None:
        """Notify DM partners and mentioned users (C2: mentions and DMs only). Best effort."""
        targets: dict[uuid.UUID, str] = {}
        if room.kind == "dm":
            for m in (await self.session.execute(select(ChatMember).where(ChatMember.room_id == room.id))).scalars():
                if m.user_id != sender:
                    targets[m.user_id] = "chat_dm"
        for uid in mentions:
            if uid != sender and await self.can_access(room, uid):
                targets[uid] = "chat_mention"
        if not targets:
            return
        try:
            from app.modules.notifications.service import NotificationService

            async with self.session.begin_nested():  # a failed notification must not poison the message
                svc = NotificationService(self.session)
                for uid, kind in targets.items():
                    await svc.create(
                        uid, kind, f"notifications.{kind}.title", entity_type="chat_room", entity_id=str(room.id),
                        body_context={"from": data.get("author_name", ""), "text": (data.get("text") or "")[:140]},
                        action_url=f"/chat/{room.id}",
                    )
        except Exception:  # noqa: BLE001 - never fail a message because of a notification
            logger.exception("team_chat: notification failed")

    async def edit_message(self, message_id: uuid.UUID, user_id: uuid.UUID, text: str) -> dict[str, Any]:
        msg = await self.session.get(ChatMessage, message_id)
        if msg is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.require_access(msg.room_id, user_id)
        if msg.author_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author can edit")
        msg.text = text.strip()
        msg.edited_at = datetime.now(UTC)
        await self.session.flush()
        data = (await self._serialize([msg]))[0]
        await chat_hub.broadcast(msg.room_id, {"event": "message.edited", "message": _jsonable(data)})
        return data

    async def mark_read(self, room_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.require_access(room_id, user_id)
        m = await self._ensure_member(room_id, user_id)
        m.last_read_at = datetime.now(UTC)
        await self.session.flush()
        await chat_hub.send_to_user(user_id, {"event": "room.read", "room_id": str(room_id)})

    # ── import (admin) ─────────────────────────────────────────────────
    async def import_history(self, req: ImportRequest, admin_id: uuid.UUID) -> ImportResult:
        res = ImportResult()
        for r in req.rooms:
            room, created, key = await self._import_room(r, admin_id)
            res.rooms_created += int(created)
            res.rooms_existing += int(not created)
            res.room_ids[key] = room.id
            src_to_id: dict[str, uuid.UUID] = {}
            for im in r.messages:
                existing = (await self.session.execute(
                    select(ChatMessage).where(ChatMessage.source_id == im.source_id))).scalars().first()
                if existing is not None:
                    src_to_id[im.source_id] = existing.id
                    res.messages_skipped += 1
                    continue
                await self._check_documents(room, im.document_ids, any_project=True)
                reply = src_to_id.get(im.reply_to_source_id or "")
                if reply is None and im.reply_to_source_id:
                    ref = (await self.session.execute(
                        select(ChatMessage).where(ChatMessage.source_id == im.reply_to_source_id))).scalars().first()
                    reply = ref.id if ref is not None else None
                meta = dict(im.metadata)
                if im.author_name:
                    meta["author_name"] = im.author_name
                msg = ChatMessage(room_id=room.id, author_id=im.author_id, text=im.text, reply_to_id=reply,
                                  document_ids=[str(d) for d in im.document_ids], source_id=im.source_id,
                                  metadata_=meta, created_at=im.created_at)
                self.session.add(msg)
                await self.session.flush()
                src_to_id[im.source_id] = msg.id
                res.messages_created += 1
        return res

    async def _import_room(self, r, admin_id: uuid.UUID) -> tuple[ChatRoom, bool, str]:
        if r.kind == "company":
            existed = (await self.session.execute(select(ChatRoom).where(ChatRoom.kind == "company"))).scalars().first()
            return await self.company_room(), existed is None, "company"
        if r.kind == "project":
            if r.project_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id required")
            existed = (await self.session.execute(select(ChatRoom).where(ChatRoom.project_id == r.project_id))).scalars().first()
            return await self._get_or_create_project_room(r.project_id, admin_id), existed is None, f"project:{r.project_id}"
        if r.kind == "dm":
            ids = list(dict.fromkeys(r.member_ids))
            if len(ids) != 2:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A DM needs exactly two users")
            key = ":".join(sorted(str(i) for i in ids))
            existed = (await self.session.execute(select(ChatRoom).where(ChatRoom.dm_key == key))).scalars().first()
            return await self._get_or_create_dm(ids, str(admin_id)), existed is None, f"dm:{key}"
        if not r.source_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source_id required for a group")
        room = (await self.session.execute(select(ChatRoom).where(ChatRoom.source_id == r.source_id))).scalars().first()
        created = room is None
        if created:
            room = ChatRoom(kind="group", name=r.name or r.source_id, created_by=str(admin_id), source_id=r.source_id)
            self.session.add(room)
            await self.session.flush()
        for uid in dict.fromkeys(r.member_ids):
            await self._ensure_member(room.id, uid)
        return room, created, f"group:{r.source_id}"


def _jsonable(d: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, list):
            out[k] = [str(x) if isinstance(x, uuid.UUID) else x for x in v]
        else:
            out[k] = v
    return out
