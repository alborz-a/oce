# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Team chat REST + WebSocket.

REST (mounted at ``/api/v1/team-chat/``):
    GET   rooms/                       caller's rooms with unread counts
    GET   rooms/project/{project_id}/  get or create the project room (project members and admins)
    POST  rooms/                       create a group or a direct room
    GET   rooms/{id}/messages/         ?before=<message id>&limit<=100, oldest first
    POST  rooms/{id}/messages/         text, reply_to_id, document_ids, mentions
    PATCH messages/{id}                author only
    POST  rooms/{id}/read/
    POST  import/                      admin only, idempotent on source_id
WebSocket ``ws/`` (first frame ``{"type":"auth","token":...}`` like global_presence):
    client -> {"type":"subscribe","room_ids":[...]} | {"type":"ping"}
    server -> {"event":"ready"} | message.created | message.edited | room.read | pong
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.core.ws_auth import refuse_socket, resolve_socket_token
from app.database import async_session_factory
from app.dependencies import CurrentUserId, RequirePermission, SessionDep, decode_access_token
from app.modules.team_chat.hub import chat_hub
from app.modules.team_chat.schemas import (
    ImportRequest,
    ImportResult,
    MessageCreate,
    MessageEdit,
    MessageResponse,
    RoomCreate,
    RoomResponse,
)
from app.modules.team_chat.service import TeamChatService

router = APIRouter(tags=["team_chat"])
logger = logging.getLogger(__name__)


def _svc(session: SessionDep) -> TeamChatService:
    return TeamChatService(session)


def _room_response(r: dict[str, Any]) -> RoomResponse:
    return RoomResponse(**r)


@router.get("/rooms/", response_model=list[RoomResponse], dependencies=[Depends(RequirePermission("team_chat.read"))])
async def list_rooms(user_id: CurrentUserId, svc: TeamChatService = Depends(_svc)) -> list[RoomResponse]:
    return [_room_response(r) for r in await svc.list_rooms(uuid.UUID(str(user_id)))]


@router.get(
    "/rooms/project/{project_id}/",
    response_model=RoomResponse,
    dependencies=[Depends(RequirePermission("team_chat.read"))],
)
async def project_room(project_id: uuid.UUID, user_id: CurrentUserId, svc: TeamChatService = Depends(_svc)) -> RoomResponse:
    room = await svc.project_room(project_id, uuid.UUID(str(user_id)))
    return RoomResponse(id=room.id, kind=room.kind, name=room.name, project_id=room.project_id)


@router.post(
    "/rooms/",
    response_model=RoomResponse,
    status_code=201,
    dependencies=[Depends(RequirePermission("team_chat.create"))],
)
async def create_room(body: RoomCreate, user_id: CurrentUserId, svc: TeamChatService = Depends(_svc)) -> RoomResponse:
    room = await svc.create_room(body.kind, body.name, body.member_ids, uuid.UUID(str(user_id)))
    return RoomResponse(id=room.id, kind=room.kind, name=room.name, member_ids=body.member_ids)


@router.get(
    "/rooms/{room_id}/messages/",
    response_model=list[MessageResponse],
    dependencies=[Depends(RequirePermission("team_chat.read"))],
)
async def list_messages(
    room_id: uuid.UUID,
    user_id: CurrentUserId,
    before: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    svc: TeamChatService = Depends(_svc),
) -> list[MessageResponse]:
    rows = await svc.list_messages(room_id, uuid.UUID(str(user_id)), before, limit)
    return [MessageResponse(**r) for r in rows]


@router.post(
    "/rooms/{room_id}/messages/",
    response_model=MessageResponse,
    status_code=201,
    dependencies=[Depends(RequirePermission("team_chat.create"))],
)
async def post_message(
    room_id: uuid.UUID, body: MessageCreate, user_id: CurrentUserId, svc: TeamChatService = Depends(_svc)
) -> MessageResponse:
    row = await svc.post_message(
        room_id, uuid.UUID(str(user_id)), body.text, body.reply_to_id, body.document_ids, body.mentions
    )
    return MessageResponse(**row)


@router.patch(
    "/messages/{message_id}",
    response_model=MessageResponse,
    dependencies=[Depends(RequirePermission("team_chat.update"))],
)
async def edit_message(
    message_id: uuid.UUID, body: MessageEdit, user_id: CurrentUserId, svc: TeamChatService = Depends(_svc)
) -> MessageResponse:
    return MessageResponse(**await svc.edit_message(message_id, uuid.UUID(str(user_id)), body.text))


@router.post("/rooms/{room_id}/read/", status_code=204, dependencies=[Depends(RequirePermission("team_chat.read"))])
async def mark_read(room_id: uuid.UUID, user_id: CurrentUserId, svc: TeamChatService = Depends(_svc)) -> None:
    await svc.mark_read(room_id, uuid.UUID(str(user_id)))


@router.post(
    "/import/",
    response_model=ImportResult,
    dependencies=[Depends(RequirePermission("team_chat.import"))],
)
async def import_history(body: ImportRequest, user_id: CurrentUserId, svc: TeamChatService = Depends(_svc)) -> ImportResult:
    """Admin only. Bulk upsert of rooms and messages with explicit authors and dates; idempotent on ``source_id``."""
    return await svc.import_history(body, uuid.UUID(str(user_id)))


# ── WebSocket ────────────────────────────────────────────────────────────────


async def _authenticate(token: str | None) -> uuid.UUID | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token, get_settings())
        from app.dependencies import verify_user_exists_and_active

        await verify_user_exists_and_active(payload["sub"], issued_at=payload.get("iat"), session_id=payload.get("sid"))
        return uuid.UUID(str(payload["sub"]))
    except (HTTPException, ValueError, KeyError):
        return None


async def _allowed_rooms(user_id: uuid.UUID, wanted: list[str] | None) -> set[uuid.UUID]:
    async with async_session_factory() as sess:
        svc = TeamChatService(sess)
        if wanted is None:
            return {r["id"] for r in await svc.list_rooms(user_id)}
        ok: set[uuid.UUID] = set()
        for raw in wanted[:500]:
            try:
                rid = uuid.UUID(str(raw))
                room = await svc.get_room(rid)
            except (ValueError, HTTPException):
                continue
            if await svc.can_access(room, user_id):
                ok.add(rid)
        return ok


@router.websocket("/ws/")
async def team_chat_ws(websocket: WebSocket, token: str | None = Query(default=None)) -> None:
    token, accepted = await resolve_socket_token(websocket, token)
    user_id = await _authenticate(token)
    if user_id is None:
        await refuse_socket(websocket, code=1008, reason="unauthenticated")
        return
    if not accepted:
        await websocket.accept()
    await chat_hub.join(websocket, user_id)
    try:
        await chat_hub.subscribe(websocket, await _allowed_rooms(user_id, None))
        await websocket.send_json({"event": "ready"})
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            raw = message.get("text")
            if raw is None:
                continue
            if raw == "ping":
                await websocket.send_json({"event": "pong"})
                continue
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(data, dict):
                continue
            if data.get("type") == "subscribe" and isinstance(data.get("room_ids"), list):
                await chat_hub.subscribe(websocket, await _allowed_rooms(user_id, data["room_ids"]))
            elif data.get("type") == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("team_chat websocket crashed")
    finally:
        await chat_hub.leave(websocket)


