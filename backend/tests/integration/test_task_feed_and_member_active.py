"""Task create feed row and member ``is_active`` flag.

A public task writes an activity row scoped to its project (``parent_entity_id``)
with ``task_title`` in metadata, so the project timeline shows it. A private task
writes no project-scoped row, so its title does not reach project members. The
project members list exposes ``is_active`` per member.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture(scope="module")
async def app_instance():
    from app.config import get_settings

    get_settings.cache_clear()

    from app.main import create_app

    app = create_app()

    async with app.router.lifespan_context(app):
        from app.database import Base, engine
        from app.modules.contacts import models as _contacts_models  # noqa: F401
        from app.modules.tasks import models as _tasks_models  # noqa: F401

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        yield app


@pytest_asyncio.fixture(scope="module")
async def http_client(app_instance):
    transport = ASGITransport(app=app_instance)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _user(client: AsyncClient, role: str = "manager") -> tuple[dict[str, str], str]:
    from sqlalchemy import select, update

    from app.database import async_session_factory
    from app.modules.users.models import User

    email = f"feed-{uuid.uuid4().hex[:8]}@tasks.io"
    password = f"FeedUser{uuid.uuid4().hex[:6]}9"
    reg = await client.post(
        "/api/v1/users/auth/register",
        json={"email": email, "password": password, "full_name": "Feed Person"},
    )
    assert reg.status_code in (200, 201), reg.text
    async with async_session_factory() as s:
        await s.execute(update(User).where(User.email == email.lower()).values(role=role, is_active=True))
        await s.commit()
        user_id = (await s.execute(select(User.id).where(User.email == email.lower()))).scalar_one()
    login = await client.post("/api/v1/users/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, str(user_id)


async def _project(client: AsyncClient, manager_id: str) -> str:
    # Restricted mode blocks project creation for non-admin users: admin creates, manager joins.
    admin, _ = await _user(client, role="admin")
    resp = await client.post(
        "/api/v1/projects/",
        json={"name": f"Feed {uuid.uuid4().hex[:6]}", "description": "feed", "currency": "EUR"},
        headers=admin,
    )
    assert resp.status_code == 201, resp.text
    project_id = resp.json()["id"]
    added = await client.post(
        f"/api/v1/projects/{project_id}/members/",
        json={"user_id": manager_id, "role": "member"},
        headers=admin,
    )
    assert added.status_code in (200, 201), added.text
    return project_id


async def _create_task(client: AsyncClient, headers: dict[str, str], project_id: str, **body: object) -> str:
    resp = await client.post(
        "/api/v1/tasks/",
        json={"project_id": project_id, "task_type": "task", "title": "Pour slab B2", **body},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _task_activity_rows(task_id: str) -> list:
    from sqlalchemy import select

    from app.core.audit_log import ActivityLog
    from app.database import async_session_factory

    async with async_session_factory() as s:
        result = await s.execute(
            select(ActivityLog).where(
                ActivityLog.entity_type == "task",
                ActivityLog.entity_id == task_id,
                ActivityLog.action == "create",
            )
        )
        return list(result.scalars().all())


@pytest.mark.asyncio
async def test_public_task_create_writes_project_scoped_feed_row(http_client):
    owner, owner_id = await _user(http_client)
    project_id = await _project(http_client, owner_id)

    task_id = await _create_task(http_client, owner, project_id, is_private=False)

    rows = await _task_activity_rows(task_id)
    assert len(rows) == 1, rows
    assert rows[0].parent_entity_id == project_id
    assert rows[0].metadata_["task_title"] == "Pour slab B2"
    assert rows[0].metadata_["title"] == "Pour slab B2"
    assert "responsible_id" in rows[0].metadata_


@pytest.mark.asyncio
async def test_private_task_create_writes_no_project_scoped_row(http_client):
    owner, owner_id = await _user(http_client)
    project_id = await _project(http_client, owner_id)

    task_id = await _create_task(http_client, owner, project_id, is_private=True)

    rows = await _task_activity_rows(task_id)
    assert len(rows) == 1, rows
    assert rows[0].parent_entity_id is None
    assert project_id not in {r.parent_entity_id for r in rows}


@pytest.mark.asyncio
async def test_members_list_item_exposes_is_active(http_client):
    owner, owner_id = await _user(http_client)
    project_id = await _project(http_client, owner_id)

    resp = await http_client.get(f"/api/v1/projects/{project_id}/members/", headers=owner)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert items, "members list must not be empty"
    for item in items:
        assert isinstance(item["is_active"], bool), item
    me = next(i for i in items if i["user_id"] == owner_id)
    assert me["is_active"] is True
