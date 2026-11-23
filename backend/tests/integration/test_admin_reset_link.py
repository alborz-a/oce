"""Admin password-reset link: admin and manager mint a single-use link, staff cannot.

Run:
    cd backend
    python -m pytest tests/integration/test_admin_reset_link.py -q
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


@pytest_asyncio.fixture(scope="module")
async def admin(http_client):
    return await _login(http_client, role="admin")


@pytest_asyncio.fixture(scope="module")
async def manager(http_client):
    return await _login(http_client, role="manager")


def _auth(h):
    return {"Authorization": h["Authorization"]}


async def _me(client, h):
    r = await client.get("/api/v1/users/me", headers=_auth(h))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _token(url: str) -> str:
    return parse_qs(urlparse(url).query)["token"][0]


@pytest.mark.asyncio
async def test_admin_link_resets_password_once(http_client, admin, staff):
    target = await _me(http_client, staff)
    r = await http_client.post(f"/api/v1/users/{target}/reset-link/", headers=_auth(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    assert "/auth/reset?token=" in body["url"] and body["expires_at"]
    new_pw = f"Brand{uuid.uuid4().hex[:6]}9x"
    ok = await http_client.post("/api/v1/users/auth/reset-password/", json={"token": _token(body["url"]), "new_password": new_pw})
    assert ok.status_code == 200, ok.text
    login = await http_client.post("/api/v1/users/auth/login", json={"email": staff["X-Email"], "password": new_pw})
    assert login.status_code == 200
    again = await http_client.post("/api/v1/users/auth/reset-password/", json={"token": _token(body["url"]), "new_password": new_pw + "z"})
    assert again.status_code == 400


@pytest.mark.asyncio
async def test_staff_cannot_mint_link(http_client, staff, manager):
    target = await _me(http_client, manager)
    r = await http_client.post(f"/api/v1/users/{target}/reset-link/", headers=_auth(staff))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_manager_cannot_reset_admin_but_can_reset_staff(http_client, manager, admin, staff):
    r = await http_client.post(f"/api/v1/users/{await _me(http_client, admin)}/reset-link/", headers=_auth(manager))
    assert r.status_code == 403
    r = await http_client.post(f"/api/v1/users/{await _me(http_client, staff)}/reset-link/", headers=_auth(manager))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_expired_link_fails(http_client, staff):
    from app.config import get_settings
    from app.database import async_session_factory
    from app.modules.users.models import User
    from app.modules.users.service import create_reset_token
    from sqlalchemy import select

    async with async_session_factory() as s:
        user = (await s.execute(select(User).where(User.email == staff["X-Email"].lower()))).scalar_one()
    token = create_reset_token(user, get_settings(), lifetime_minutes=-5)
    r = await http_client.post("/api/v1/users/auth/reset-password/", json={"token": token, "new_password": "Whatever1234x"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_link_survives_activity_and_other_links_then_burns_once(http_client, admin, staff):
    """Opening the page / signing in / minting a second link never burns a link; only saving a password does."""
    from datetime import datetime, timedelta

    target = await _me(http_client, staff)
    first = (await http_client.post(f"/api/v1/users/{target}/reset-link/", headers=_auth(admin), json={"days": 7})).json()
    exp = datetime.fromisoformat(first["expires_at"].replace("Z", "+00:00"))
    assert timedelta(days=6, hours=23) < exp - datetime.now(exp.tzinfo) <= timedelta(days=7, minutes=1)
    # the "page opens" any number of times: nothing server side is consumed, and signing in does not burn it either
    for _ in range(2):
        r = await http_client.post("/api/v1/users/auth/login", json={"email": staff["X-Email"], "password": staff["X-Password"]})
        assert r.status_code == 200
    second = (await http_client.post(f"/api/v1/users/{target}/reset-link/", headers=_auth(admin))).json()
    new_pw = f"Fresh{uuid.uuid4().hex[:6]}8y"
    ok = await http_client.post("/api/v1/users/auth/reset-password/", json={"token": _token(first["url"]), "new_password": new_pw})
    assert ok.status_code == 200, ok.text
    for url in (first["url"], second["url"]):
        used = await http_client.post("/api/v1/users/auth/reset-password/", json={"token": _token(url), "new_password": new_pw + "q"})
        assert used.status_code == 400


@pytest.mark.asyncio
async def test_rejects_unknown_duration(http_client, admin, staff):
    r = await http_client.post(f"/api/v1/users/{await _me(http_client, staff)}/reset-link/", headers=_auth(admin), json={"days": 2})
    assert r.status_code == 422
