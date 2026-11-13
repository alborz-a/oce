"""Global manager read-all access suite.

A user whose GLOBAL role is ``manager`` may READ every project and its
photos and documents, but must not write to a project they do not belong to.
Writes by a manager stay governed by the owner / team-member rules.

Fixture style mirrors ``test_team_member_project_access.py``. Non-member
viewers must still receive 404 on reads (IDOR defence).
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.tenant_isolation

# ── App fixture ────────────────────────────────────────────────────────────


@pytest_asyncio.fixture(scope="module")
async def app_instance():
    """Boot the FastAPI app once for the whole module."""
    from app.config import get_settings

    get_settings.cache_clear()

    from app.main import create_app

    app = create_app()

    async with app.router.lifespan_context(app):
        from app.database import Base, engine

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        yield app


@pytest_asyncio.fixture(scope="module")
async def http_client(app_instance):
    transport = ASGITransport(app=app_instance)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Helpers ────────────────────────────────────────────────────────────────


async def _activate_user(email: str) -> None:
    """Force is_active=True so login works under admin-approve mode."""
    from sqlalchemy import update

    from app.database import async_session_factory
    from app.modules.users.models import User

    async with async_session_factory() as s:
        await s.execute(update(User).where(User.email == email.lower()).values(is_active=True))
        await s.commit()


async def _set_role(email: str, role: str) -> None:
    """Set a user's platform role directly, ahead of the login that mints its token."""
    from sqlalchemy import update

    from app.database import async_session_factory
    from app.modules.users.models import User

    async with async_session_factory() as s:
        await s.execute(update(User).where(User.email == email.lower()).values(role=role))
        await s.commit()


async def _register_and_login(
    client: AsyncClient, suffix: str, *, role: str | None = None
) -> tuple[str, dict[str, str]]:
    """Register a fresh user, activate, login. Returns (user_id, auth_headers).

    ``role`` promotes the account before the token is issued, so the role
    claim in the JWT is the promoted one.
    """
    email = f"user-{suffix}-{uuid.uuid4().hex[:6]}@manager-read.io"
    password = f"ManagerRead{uuid.uuid4().hex[:6]}9!"

    reg = await client.post(
        "/api/v1/users/auth/register",
        json={"email": email, "password": password, "full_name": f"User {suffix}"},
    )
    assert reg.status_code in (200, 201), f"register failed: {reg.text}"
    user_id = reg.json()["id"]

    await _activate_user(email)
    if role is not None:
        await _set_role(email, role)

    login = await client.post(
        "/api/v1/users/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, f"login failed: {login.text}"
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return user_id, headers


# ── Shared fixture: A (admin) owns P; M is a global manager, not a member ──


@pytest_asyncio.fixture(scope="module")
async def scenario(http_client):
    """
    A (admin) creates project P. M is a global ``manager`` with NO membership
    in P. V is a plain ``viewer`` with no connection to P.
    """
    _, a_headers = await _register_and_login(http_client, "A", role="admin")
    _, m_headers = await _register_and_login(http_client, "M", role="manager")
    _, v_headers = await _register_and_login(http_client, "V")

    proj_resp = await http_client.post(
        "/api/v1/projects/",
        json={"name": "Manager Read Project", "currency": "EUR"},
        headers=a_headers,
    )
    assert proj_resp.status_code in (200, 201), f"create project failed: {proj_resp.text}"
    project_id = proj_resp.json()["id"]

    return {
        "project_id": project_id,
        "a_headers": a_headers,
        "m_headers": m_headers,
        "v_headers": v_headers,
    }


# ── Tests ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_manager_can_get_non_member_project(http_client, scenario):
    """(a) M (global manager, not a member) can GET project P."""
    pid = scenario["project_id"]
    resp = await http_client.get(f"/api/v1/projects/{pid}", headers=scenario["m_headers"])
    assert resp.status_code == 200, f"GET project as manager: {resp.text}"


@pytest.mark.asyncio
async def test_manager_sees_non_member_project_in_list(http_client, scenario):
    """(b) M's project listing contains P."""
    resp = await http_client.get("/api/v1/projects/", headers=scenario["m_headers"])
    assert resp.status_code == 200, f"list projects as manager: {resp.text}"
    ids = [p["id"] for p in resp.json()]
    assert scenario["project_id"] in ids, "manager cannot see non-member project in listing"


@pytest.mark.asyncio
async def test_manager_can_list_photos_of_non_member_project(http_client, scenario):
    """(c) M can list the photos of P with project_id filter."""
    pid = scenario["project_id"]
    resp = await http_client.get(f"/api/v1/documents/photos/?project_id={pid}", headers=scenario["m_headers"])
    assert resp.status_code == 200, f"list photos as manager: {resp.text}"


@pytest.mark.asyncio
async def test_manager_cannot_upload_photo_to_non_member_project(http_client, scenario):
    """(d) Writes stay denied: M cannot upload a photo to P.

    The permission gate can answer 403 before the membership check runs, so
    either denial is accepted. A 201 would be a write leak.
    """
    pid = scenario["project_id"]
    resp = await http_client.post(
        f"/api/v1/documents/photos/upload/?project_id={pid}",
        data={"category": "site"},
        files={"file": ("p.jpg", b"\xff\xd8\xff\xe0test", "image/jpeg")},
        headers=scenario["m_headers"],
    )
    assert resp.status_code in (403, 404), f"manager upload must be denied, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_manager_cannot_patch_non_member_project(http_client, scenario):
    """(e) Writes stay denied: M cannot PATCH P."""
    pid = scenario["project_id"]
    resp = await http_client.patch(
        f"/api/v1/projects/{pid}",
        json={"name": "Hijacked by manager"},
        headers=scenario["m_headers"],
    )
    assert resp.status_code in (403, 404), f"manager PATCH must be denied, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_viewer_non_member_still_404_on_project(http_client, scenario):
    """(f) Regression: a plain viewer with no membership still gets 404 on GET P."""
    pid = scenario["project_id"]
    resp = await http_client.get(f"/api/v1/projects/{pid}", headers=scenario["v_headers"])
    assert resp.status_code == 404, f"viewer must get 404 (IDOR defence), got {resp.status_code}"
