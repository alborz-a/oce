# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""In-memory WebSocket hub for chat rooms (pattern of ``global_presence.hub``).

A socket joins as a user, then subscribes to rooms the router has already checked it may read. ``broadcast`` sends an
event to every subscriber of a room; dead sockets are scrubbed. One process only (see the package docstring).
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import WebSocket


class ChatHub:
    def __init__(self) -> None:
        self._users: dict[WebSocket, uuid.UUID] = {}
        self._subs: dict[WebSocket, set[uuid.UUID]] = {}
        self._lock = asyncio.Lock()

    async def join(self, ws: WebSocket, user_id: uuid.UUID) -> None:
        async with self._lock:
            self._users[ws] = user_id
            self._subs[ws] = set()

    async def subscribe(self, ws: WebSocket, room_ids: set[uuid.UUID]) -> None:
        async with self._lock:
            if ws in self._subs:
                self._subs[ws] = set(room_ids)

    async def leave(self, ws: WebSocket) -> None:
        async with self._lock:
            self._users.pop(ws, None)
            self._subs.pop(ws, None)

    async def broadcast(self, room_id: uuid.UUID, event: dict[str, Any], *, exclude: WebSocket | None = None) -> int:
        async with self._lock:
            targets = [ws for ws, rooms in self._subs.items() if room_id in rooms]
        sent, dead = 0, []
        for ws in targets:
            if ws is exclude:
                continue
            try:
                await ws.send_json(event)
                sent += 1
            except Exception:  # noqa: BLE001 - dead socket
                dead.append(ws)
        for ws in dead:
            await self.leave(ws)
        return sent

    async def send_to_user(self, user_id: uuid.UUID, event: dict[str, Any]) -> int:
        async with self._lock:
            targets = [ws for ws, uid in self._users.items() if uid == user_id]
        sent = 0
        for ws in targets:
            try:
                await ws.send_json(event)
                sent += 1
            except Exception:  # noqa: BLE001
                await self.leave(ws)
        return sent

    def connection_count(self) -> int:
        return len(self._users)

    def reset(self) -> None:
        self._users.clear()
        self._subs.clear()


chat_hub = ChatHub()
