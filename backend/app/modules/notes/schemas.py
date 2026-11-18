# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Personal notes request and response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    title: str = Field(default="", max_length=200)
    body: str = ""
    color: str = Field(default="#fb0", max_length=16)
    pinned: bool = False


class NotePatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    body: str | None = None
    color: str | None = Field(default=None, max_length=16)
    pinned: bool | None = None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str
    color: str
    pinned: bool
    created_at: datetime
    updated_at: datetime
