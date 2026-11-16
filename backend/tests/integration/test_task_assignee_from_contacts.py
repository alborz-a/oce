"""A task assignee picked from contacts.

A contact linked to a platform user makes that user the task's
``responsible_id``, so the task shows up in their my-tasks list. A contact
without a user is kept by name. A contact of another tenant, or one that does
not exist, is refused with 404.
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

    email = f"task-assignee-{uuid.uuid4().hex[:8]}@tasks.io"
    password = f"TaskAssign{uuid.uuid4().hex[:6]}9"
    reg = await client.post(
        "/api/v1/users/auth/register",
        json={"email": email, "password": password, "full_name": "Task Person"},
    )
    assert reg.status_code in (200, 201), reg.text
    async with async_session_factory() as s:
        await s.execute(update(User).where(User.email == email.lower()).values(role=role, is_active=True))
        await s.commit()
        user_id = (await s.execute(select(User.id).where(User.email == email.lower()))).scalar_one()
    login = await client.post("/api/v1/users/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, str(user_id)


async def _contact(client: AsyncClient, owner_id: str, first_name: str, user_id: str | None = None) -> str:
    # Restricted mode blocks contact creation for non-admin users. An admin creates the
    # row, then created_by is set to the owner so the tenant check treats it as the owner's contact.
    from sqlalchemy import update

    from app.database import async_session_factory
    from app.modules.contacts.models import Contact

    admin, _ = await _user(client, role="admin")
    resp = await client.post(
        "/api/v1/contacts/",
        json={"contact_type": "subcontractor", "first_name": first_name, "company_name": f"{first_name} Ltd"},
        headers=admin,
    )
    assert resp.status_code in (200, 201), resp.text
    contact_id = resp.json()["id"]
    values: dict[str, object] = {"created_by": owner_id}
    if user_id is not None:
        values["user_id"] = uuid.UUID(user_id)
    async with async_session_factory() as s:
        await s.execute(update(Contact).where(Contact.id == uuid.UUID(contact_id)).values(**values))
        await s.commit()
    return contact_id


async def _project(client: AsyncClient, manager_id: str) -> str:
    # Restricted mode blocks project creation for every non-admin user, so an admin
    # creates the project and adds the manager as project_manager (task.manage is needed for PATCH).
    admin, _ = await _user(client, role="admin")
    resp = await client.post(
        "/api/v1/projects/",
        json={"name": f"Tasks {uuid.uuid4().hex[:6]}", "description": "assignee", "currency": "EUR"},
        headers=admin,
    )
    assert resp.status_code == 201, resp.text
    project_id = resp.json()["id"]
    added = await client.post(
        f"/api/v1/projects/{project_id}/members/",
        json={"user_id": manager_id, "role": "project_manager"},
        headers=admin,
    )
    assert added.status_code in (200, 201), added.text
    return project_id


async def _task(client: AsyncClient, headers: dict[str, str], project_id: str, **body: object):
    return await client.post(
        "/api/v1/tasks/",
        json={"project_id": project_id, "task_type": "task", "title": "Check rebar", **body},
        headers=headers,
    )


@pytest.mark.asyncio
async def test_a_contact_linked_to_a_user_assigns_that_user(http_client):
    owner, owner_id = await _user(http_client)
    colleague, colleague_id = await _user(http_client, role="editor")
    project_id = await _project(http_client, owner_id)
    contact_id = await _contact(http_client, owner_id, "Ana", user_id=colleague_id)

    created = await _task(http_client, owner, project_id, assignee_contact_id=contact_id)
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["responsible_id"] == colleague_id
    assert task["metadata"]["assignee_contact_id"] == contact_id
    assert task["metadata"]["assignee_name"] == "Ana"

    mine = await http_client.get("/api/v1/tasks/my-tasks/", headers=colleague)
    assert mine.status_code == 200, mine.text
    assert task["id"] in {t["id"] for t in mine.json()["items"]}


@pytest.mark.asyncio
async def test_a_contact_without_a_user_is_kept_by_name_and_can_be_changed(http_client):
    owner, owner_id = await _user(http_client)
    project_id = await _project(http_client, owner_id)
    plain = await _contact(http_client, owner_id, "Bruno")

    created = await _task(http_client, owner, project_id, assignee_contact_id=plain)
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["responsible_id"] is None
    assert task["metadata"]["assignee_name"] == "Bruno"

    # Switching to a user by id drops the contact link and its name.
    patched = await http_client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={
            "responsible_id": owner_id,
            "assignee_contact_id": None,
            "metadata": {"assignee_name": None},
        },
        headers=owner,
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["responsible_id"] == owner_id
    assert body["metadata"].get("assignee_contact_id") is None
    assert body["metadata"].get("assignee_name") is None

    # And back to the contact on PATCH.
    again = await http_client.patch(f"/api/v1/tasks/{task['id']}", json={"assignee_contact_id": plain}, headers=owner)
    assert again.status_code == 200, again.text
    assert again.json()["responsible_id"] is None
    assert again.json()["metadata"]["assignee_contact_id"] == plain


@pytest.mark.asyncio
async def test_a_foreign_or_missing_contact_is_refused(http_client):
    owner, owner_id = await _user(http_client)
    stranger, stranger_id = await _user(http_client)
    project_id = await _project(http_client, owner_id)
    foreign = await _contact(http_client, stranger_id, "Carla")

    for contact_id in (foreign, str(uuid.uuid4())):
        resp = await _task(http_client, owner, project_id, assignee_contact_id=contact_id)
        assert resp.status_code == 404, resp.text

    task = (await _task(http_client, owner, project_id)).json()
    resp = await http_client.patch(f"/api/v1/tasks/{task['id']}", json={"assignee_contact_id": foreign}, headers=owner)
    assert resp.status_code == 404, resp.text
