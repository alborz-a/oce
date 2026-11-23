"""Staff project lock on the X-API-Key door and on WebSocket paths.

Run:
    cd backend
    python -m pytest tests/integration/test_staff_lock_apikey_ws.py -q
"""

from __future__ import annotations

import uuid
from urllib.parse import parse_qs, urlparse

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import app.modules.users.models  # noqa: F401


@pytest_asyncio.fixture(scope="module")
async def app_instance():
    from app.config import get_settings

    get_settings.cache_clear()

    from app.main import create_app

    fastapi_app = create_app()

    async with fastapi_app.router.lifespan_context(fastapi_app):
        from app.database import Base, engine

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        yield fastapi_app


@pytest_asyncio.fixture(scope="module")
async def http_client(app_instance):
    transport = ASGITransport(app=app_instance)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _login(client: AsyncClient, *, role: str | None) -> dict[str, str]:
    email = f"scope-{role or 'default'}-{uuid.uuid4().hex[:8]}@staff-scope.io"
    password = f"StaffScope{uuid.uuid4().hex[:6]}9"
    reg = await client.post(
        "/api/v1/users/auth/register",
        json={"email": email, "password": password, "full_name": f"Scope {role}"},
    )
    assert reg.status_code in (200, 201), reg.text

    from sqlalchemy import update

    from app.database import async_session_factory
    from app.modules.users.models import User

    values: dict = {"is_active": True}
    if role is not None:
        values["role"] = role
    async with async_session_factory() as s:
        await s.execute(update(User).where(User.email == email.lower()).values(**values))
        await s.commit()

    login = await client.post("/api/v1/users/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}", "X-Email": email, "X-Password": password}



@pytest_asyncio.fixture
async def staff(http_client):
    return await _login(http_client, role="editor")


@pytest_asyncio.fixture
async def manager(http_client):
    return await _login(http_client, role="manager")


async def _key(client, h) -> str:
    r = await client.post("/api/v1/users/me/api-keys/", headers={"Authorization": h["Authorization"]}, json={"name": "t", "permissions": []})
    assert r.status_code == 201, r.text
    return r.json()["key"]


@pytest.mark.asyncio
async def test_staff_api_key_cannot_reach_oce_routes(http_client, staff, manager):
    staff_key = await _key(http_client, staff)
    r = await http_client.post("/api/v1/inbound_capture/email", headers={"X-API-Key": staff_key}, json={})
    assert r.status_code == 403 and ("staff accounts" in r.text or "restricted mode" in r.text), r.text
    mgr_key = await _key(http_client, manager)
    r2 = await http_client.post("/api/v1/inbound_capture/email", headers={"X-API-Key": mgr_key}, json={})
    assert "staff accounts" not in r2.text


def test_websocket_paths_follow_the_staff_lock():
    from app.core.staff_scope import is_staff_ws_allowed

    assert is_staff_ws_allowed("editor", "/api/v1/notifications/ws/")
    assert is_staff_ws_allowed("editor", "/api/v1/team-chat/ws/")
    assert is_staff_ws_allowed("editor", "/api/v1/global_presence/ws/")
    assert not is_staff_ws_allowed("editor", "/api/v1/collaboration_locks/presence/")
    assert is_staff_ws_allowed("manager", "/api/v1/collaboration_locks/presence/")
    assert is_staff_ws_allowed("admin", "/api/v1/collaboration_locks/presence/")
