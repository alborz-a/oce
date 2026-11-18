# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Personal notes REST (mounted at ``/api/v1/notes/``). Any authenticated user; owner-scoped.

    GET    /              caller's notes, pinned first then updated_at desc
    POST   /              create
    PATCH  /{id}/         owner only (404 otherwise)
    DELETE /{id}/         owner only (404 otherwise)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.dependencies import CurrentUserId, SessionDep
from app.modules.notes import service
from app.modules.notes.schemas import NoteCreate, NotePatch, NoteResponse

router = APIRouter(tags=["notes"])


@router.get("/", response_model=list[NoteResponse])
async def list_notes(user_id: CurrentUserId, session: SessionDep) -> list[NoteResponse]:
    items = await service.list_notes(session, user_id)
    return [NoteResponse.model_validate(n) for n in items]


@router.post("/", response_model=NoteResponse, status_code=201)
async def create_note(data: NoteCreate, user_id: CurrentUserId, session: SessionDep) -> NoteResponse:
    note = await service.create_note(session, user_id, data)
    return NoteResponse.model_validate(note)


@router.patch("/{note_id}/", response_model=NoteResponse)
async def update_note(
    note_id: uuid.UUID, data: NotePatch, user_id: CurrentUserId, session: SessionDep
) -> NoteResponse:
    note = await service.update_note(session, user_id, note_id, data)
    return NoteResponse.model_validate(note)


@router.delete("/{note_id}/", status_code=204, response_class=Response)
async def delete_note(note_id: uuid.UUID, user_id: CurrentUserId, session: SessionDep) -> Response:
    await service.delete_note(session, user_id, note_id)
    return Response(status_code=204)
