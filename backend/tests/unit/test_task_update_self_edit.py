"""PATCH /tasks/{id} authorisation: creator and assignee may edit their own task."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.modules.tasks import router as task_router

PROJECT_ID = uuid.uuid4()
CREATOR = str(uuid.uuid4())
ASSIGNEE = str(uuid.uuid4())
OTHER = str(uuid.uuid4())


def _task(created_by: str = CREATOR, responsible_id: str | None = ASSIGNEE):
    return SimpleNamespace(
        id=uuid.uuid4(),
        project_id=PROJECT_ID,
        created_by=created_by,
        responsible_id=responsible_id,
        persons_involved=[],
    )


async def _call_update(monkeypatch, user_id: str, caps: set[str], task):
    monkeypatch.setattr(task_router, "verify_project_access", AsyncMock())
    monkeypatch.setattr(task_router, "get_project_caps", AsyncMock(return_value=caps))
    monkeypatch.setattr(
        task_router, "_to_response_resolved", AsyncMock(return_value="ok")
    )
    service = MagicMock()
    service.get_task = AsyncMock(return_value=task)
    service.update_task = AsyncMock(return_value=task)
    return await task_router.update_task(
        task_id=task.id,
        data=MagicMock(),
        session=MagicMock(),
        user_id=user_id,
        payload={"role": "member"},
        _perm=None,
        service=service,
    )


@pytest.mark.asyncio
async def test_creator_without_task_manage_may_edit(monkeypatch):
    task = _task()
    result = await _call_update(
        monkeypatch, CREATOR, {"module.tasks", "task.work"}, task
    )
    assert result == "ok"


@pytest.mark.asyncio
async def test_assignee_without_task_manage_may_edit(monkeypatch):
    task = _task()
    result = await _call_update(
        monkeypatch, ASSIGNEE, {"module.tasks", "task.work"}, task
    )
    assert result == "ok"


@pytest.mark.asyncio
async def test_unrelated_member_without_task_manage_gets_403(monkeypatch):
    task = _task()
    with pytest.raises(HTTPException) as exc:
        await _call_update(monkeypatch, OTHER, {"module.tasks", "task.work"}, task)
    assert exc.value.status_code == 403
    assert exc.value.detail == "project_capability_required:task.manage"


@pytest.mark.asyncio
async def test_manager_may_edit_unrelated_task(monkeypatch):
    task = _task()
    result = await _call_update(
        monkeypatch, OTHER, {"module.tasks", "task.manage"}, task
    )
    assert result == "ok"
