"""Staff API scope: editor/viewer accounts get 403 outside the Mizito shell.

Admin and manager keep the full API. Unauthenticated calls keep their 401.
The OCE sample routes are taken from the live app, so a renamed prefix fails
the test instead of silently passing.

Run:
    cd backend
    python -m pytest tests/integration/test_staff_api_scope.py -q
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import app.modules.users.models  # noqa: F401

OCE_PREFIXES = ("/api/v1/boq", "/api/v1/costs", "/api/v1/finance", "/api/v1/variations")
STAFF_DENIAL = "This area is not available for staff accounts"
SHELL_PATHS = (
    "/api/v1/users/me",
    "/api/v1/projects/",
    "/api/v1/team-chat/rooms",
    "/api/v1/team_chat/rooms",
    "/api/v1/notifications",
    "/api/v1/tasks",
    "/api/v1/meetings",
    "/api/v1/documents",
    "/api/v1/correspondence",
    "/api/v1/teams",
    "/api/v1/notes",
    "/api/v1/health",
)


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
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest_asyncio.fixture(scope="module")
async def staff_editor(http_client):
    return await _login(http_client, role="editor")


@pytest_asyncio.fixture(scope="module")
async def staff_viewer(http_client):
    return await _login(http_client, role="viewer")


@pytest_asyncio.fixture(scope="module")
async def admin_headers(http_client):
    return await _login(http_client, role="admin")


@pytest_asyncio.fixture(scope="module")
async def manager_headers(http_client):
    return await _login(http_client, role="manager")


def _oce_get_paths(app_instance) -> list[tuple[str, str]]:
    """Concrete GET paths under each OCE prefix, taken from the live route table."""
    # Included routers are nested (FastAPI _IncludedRouter), so read the OpenAPI
    # schema, which lists every mounted path with its methods.
    schema_paths = app_instance.openapi()["paths"]
    out: list[tuple[str, str]] = []
    for prefix in OCE_PREFIXES:
        found = sorted(p for p, ops in schema_paths.items() if p.startswith(prefix + "/"))
        for path in found[:3]:
            ops = schema_paths[path]
            method = next(m for m in ("get", "post", "put", "patch", "delete") if m in ops)
            out.append((method.upper(), _fill(path)))
    return out


def _fill(path: str) -> str:
    import re

    return re.sub(r"\{[^}]+\}", str(uuid.UUID(int=1)), path)


@pytest.mark.asyncio
async def test_oce_prefixes_exist_in_live_app(app_instance):
    paths = _oce_get_paths(app_instance)
    for prefix in OCE_PREFIXES:
        assert any(p.startswith(prefix + "/") for _, p in paths), f"no route under {prefix}"


@pytest.mark.asyncio
async def test_staff_editor_gets_403_on_oce_routes(http_client, app_instance, staff_editor):
    for method, path in _oce_get_paths(app_instance):
        res = await http_client.request(method, path, headers=staff_editor)
        assert res.status_code == 403, f"{method} {path} -> {res.status_code}"
        assert res.json().get("detail") == STAFF_DENIAL, f"{method} {path} denied by something else"


@pytest.mark.asyncio
async def test_staff_viewer_gets_403_on_oce_routes(http_client, app_instance, staff_viewer):
    for method, path in _oce_get_paths(app_instance):
        res = await http_client.request(method, path, headers=staff_viewer)
        assert res.status_code == 403, f"{method} {path} -> {res.status_code}"
        assert res.json().get("detail") == STAFF_DENIAL, f"{method} {path} denied by something else"


@pytest.mark.asyncio
async def test_staff_keeps_shell_endpoints(http_client, staff_editor):
    for path in SHELL_PATHS:
        res = await http_client.get(path, headers=staff_editor)
        # Not the staff gate. A 403 from the role or permission check on a shell path is allowed.
        if res.status_code == 403:
            assert res.json().get("detail") != STAFF_DENIAL, f"{path} gated"


@pytest.mark.asyncio
async def test_admin_and_manager_unaffected(http_client, app_instance, admin_headers, manager_headers):
    for headers in (admin_headers, manager_headers):
        for method, path in _oce_get_paths(app_instance):
            res = await http_client.request(method, path, headers=headers)
            if res.status_code == 403:
                assert res.json().get("detail") != STAFF_DENIAL, f"{method} {path} staff gate hit admin/manager"


@pytest.mark.asyncio
async def test_unauthenticated_keeps_401(http_client, app_instance):
    method, path = _oce_get_paths(app_instance)[0]
    res = await http_client.request(method, path)
    assert res.status_code == 401, res.status_code
