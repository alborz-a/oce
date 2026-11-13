"""Project-member photo access regression suite.

Pins the policy that a plain project member (global role ``viewer``) can
add photos with a caption and edit a photo caption on projects they belong
to, while project access stays enforced per project by
``verify_project_access`` (uninvited users get 404, not 403).

Deletion and generic document uploads stay restricted to their existing
roles, and these tests pin that too.

Test scaffolding mirrors ``test_team_member_project_access.py``.
"""

from __future__ import annotations

import io
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.tenant_isolation

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)

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
    """Register a fresh user, activate, login. Returns (user_id, auth_headers)."""
    email = f"member-{suffix}-{uuid.uuid4().hex[:6]}@member-photo.io"
    password = f"MemberPhoto{uuid.uuid4().hex[:6]}9!"

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


async def _upload_photo(client: AsyncClient, project_id: str, headers: dict[str, str], caption: str):
    return await client.post(
        f"/api/v1/documents/photos/upload/?project_id={project_id}",
        data={"caption": caption},
        files={"file": ("member.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=headers,
    )


# ── Shared fixture: A owns a project, B is a viewer member, C is not ───────


@pytest_asyncio.fixture(scope="module")
async def scenario(http_client):
    """
    A (admin) creates a project and adds B as a project member.
    B and C stay on the ``viewer`` role that self-registration hands out.
    C has no connection to the project.
    """
    _, a_headers = await _register_and_login(http_client, "A", role="admin")
    b_id, b_headers = await _register_and_login(http_client, "B")
    _, c_headers = await _register_and_login(http_client, "C")

    proj_resp = await http_client.post(
        "/api/v1/projects/",
        json={"name": "Member Photo Project", "currency": "EUR"},
        headers=a_headers,
    )
    assert proj_resp.status_code in (200, 201), f"create project failed: {proj_resp.text}"
    project_id = proj_resp.json()["id"]

    add_resp = await http_client.post(
        f"/api/v1/projects/{project_id}/members/",
        json={"user_id": b_id, "role": "viewer"},
        headers=a_headers,
    )
    assert add_resp.status_code in (200, 201), f"add member failed: {add_resp.text}"

    return {
        "project_id": project_id,
        "a_headers": a_headers,
        "b_headers": b_headers,
        "c_headers": c_headers,
    }


# ── Tests ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_viewer_member_can_upload_photo_with_caption(http_client, scenario):
    """(a) B, a viewer and project member, uploads a photo and the caption is saved."""
    resp = await _upload_photo(
        http_client, scenario["project_id"], scenario["b_headers"], "Member caption"
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["caption"] == "Member caption"


@pytest.mark.asyncio
async def test_viewer_non_member_cannot_upload_photo(http_client, scenario):
    """(b) C, a viewer with no membership, gets 404 for the same project (IDOR-safe)."""
    resp = await _upload_photo(
        http_client, scenario["project_id"], scenario["c_headers"], "Intruder"
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_viewer_member_can_patch_caption(http_client, scenario):
    """(c) B, a viewer member, edits the caption of a photo in the project."""
    up = await _upload_photo(
        http_client, scenario["project_id"], scenario["a_headers"], "Original"
    )
    assert up.status_code == 201, up.text
    photo_id = up.json()["id"]

    resp = await http_client.patch(
        f"/api/v1/documents/photos/{photo_id}",
        json={"caption": "Edited by member"},
        headers=scenario["b_headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["caption"] == "Edited by member"


@pytest.mark.asyncio
async def test_viewer_member_cannot_delete_photo(http_client, scenario):
    """(d) B, a viewer member, is refused DELETE on a photo (documents.delete is manager+)."""
    up = await _upload_photo(
        http_client, scenario["project_id"], scenario["a_headers"], "To keep"
    )
    assert up.status_code == 201, up.text
    photo_id = up.json()["id"]

    resp = await http_client.delete(
        f"/api/v1/documents/photos/{photo_id}",
        headers=scenario["b_headers"],
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_viewer_member_cannot_upload_generic_document(http_client, scenario):
    """(e) B, a viewer member, is refused the generic document upload (documents.create is editor+)."""
    resp = await http_client.post(
        f"/api/v1/documents/upload/?project_id={scenario['project_id']}",
        files={"file": ("doc.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=scenario["b_headers"],
    )
    assert resp.status_code == 403, resp.text
