# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Team chat request / response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

MAX_TEXT = 16000


class RoomResponse(BaseModel):
    id: uuid.UUID
    kind: str
    name: str
    project_id: uuid.UUID | None = None
    unread: int = 0
    last_message_at: datetime | None = None
    member_ids: list[uuid.UUID] = Field(default_factory=list)


class RoomCreate(BaseModel):
    kind: Literal["group", "dm"]
    name: str = Field(default="", max_length=255)
    member_ids: list[uuid.UUID] = Field(default_factory=list)


class MessageCreate(BaseModel):
    text: str = Field(default="", max_length=MAX_TEXT)
    reply_to_id: uuid.UUID | None = None
    document_ids: list[uuid.UUID] = Field(default_factory=list)
    mentions: list[uuid.UUID] = Field(default_factory=list)


class MessageEdit(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT)


class MessageResponse(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    author_id: uuid.UUID | None = None
    author_name: str = ""
    text: str
    reply_to_id: uuid.UUID | None = None
    document_ids: list[uuid.UUID] = Field(default_factory=list)
    created_at: datetime
    edited_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ImportMessage(BaseModel):
    source_id: str = Field(min_length=1, max_length=200)
    author_id: uuid.UUID | None = None
    author_name: str = ""
    text: str = Field(default="", max_length=MAX_TEXT)
    created_at: datetime
    reply_to_source_id: str | None = None
    # Linked OCE documents (already registered). Lets the importer replace "[file] key" text by real documents.
    document_ids: list[uuid.UUID] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ImportRoom(BaseModel):
    kind: Literal["company", "project", "group", "dm"]
    source_id: str | None = Field(default=None, max_length=200)  # required for group
    name: str = Field(default="", max_length=255)
    project_id: uuid.UUID | None = None  # required for project
    member_ids: list[uuid.UUID] = Field(default_factory=list)  # group members / the two dm users
    messages: list[ImportMessage] = Field(default_factory=list)


class ImportRequest(BaseModel):
    rooms: list[ImportRoom] = Field(min_length=1, max_length=50)


class ImportResult(BaseModel):
    rooms_created: int = 0
    rooms_existing: int = 0
    messages_created: int = 0
    messages_skipped: int = 0
    room_ids: dict[str, uuid.UUID] = Field(default_factory=dict)  # source_id/key -> room id
