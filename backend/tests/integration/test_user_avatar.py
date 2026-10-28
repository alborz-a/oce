"""Integration tests for user profile pictures.

Covers:
    * a user uploads their own picture: the user record carries ``avatar_url``
      and ``GET /users/{id}/avatar`` serves a 256 px WebP;
    * removing it clears the URL and the file answers 404;
    * a non-image, an oversized file and a wrong type are refused;
    * an admin sets another user's picture, a viewer cannot;
    * an unauthenticated request cannot read a picture.

The module-scoped client + auth fixtures mirror ``test_admin_delete_user.py``.
"""

from __future__ import annotations

import io
import uuid
from contextlib import asynccontextmanager

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.main import create_app
from tests.integration.test_admin_delete_user import _create_user, _login


@pytest_asyncio.fixture(scope="module")
async def avatar_client():
    app = create_app()

    @asynccontextmanager
    async def lifespan_ctx():
        async with app.router.lifespan_context(app):
            yield

    async with lifespan_ctx():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest_asyncio.fixture(scope="module")
async def admin_auth(avatar_client: AsyncClient) -> dict[str, str]:
    unique = uuid.uuid4().hex[:8]
    email = f"avatar-admin-{unique}@test.io"
    password = f"AvatarAdm{unique}9"
    reg = await avatar_client.post(
        "/api/v1/users/auth/register",
        json={"email": email, "password": password, "full_name": "Avatar Admin", "role": "admin"},
    )
    assert reg.status_code == 201, reg.text
    from tests.integration._auth_helpers import promote_to_admin

    await promote_to_admin(email)
    token = await _login(avatar_client, email, password)
    assert token
    return {"Authorization": f"Bearer {token}"}


def _image(fmt: str = "PNG", size: tuple[int, int] = (600, 400)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, format=fmt)
    return buf.getvalue()


async def _viewer(client: AsyncClient, admin_auth: dict[str, str]) -> tuple[str, dict[str, str]]:
    uid, email, password = await _create_user(client, admin_auth)
    token = await _login(client, email, password)
    assert token
    return uid, {"Authorization": f"Bearer {token}"}


class TestUserAvatar:
    async def test_user_uploads_and_removes_own_picture(self, avatar_client: AsyncClient, admin_auth) -> None:
        uid, auth = await _viewer(avatar_client, admin_auth)

        before = await avatar_client.get("/api/v1/users/me/", headers=auth)
        assert before.json()["avatar_url"] is None
        assert (await avatar_client.get(f"/api/v1/users/{uid}/avatar", headers=auth)).status_code == 404

        up = await avatar_client.put(
            "/api/v1/users/me/avatar",
            files={"file": ("me.png", _image(), "image/png")},
            headers=auth,
        )
        assert up.status_code == 200, up.text
        assert up.json()["avatar_url"].startswith(f"/api/v1/users/{uid}/avatar")

        got = await avatar_client.get(f"/api/v1/users/{uid}/avatar", headers=auth)
        assert got.status_code == 200
        assert got.headers["content-type"] == "image/webp"
        with Image.open(io.BytesIO(got.content)) as img:
            assert img.size == (256, 256)
            assert img.format == "WEBP"

        gone = await avatar_client.delete("/api/v1/users/me/avatar", headers=auth)
        assert gone.status_code == 200, gone.text
        assert gone.json()["avatar_url"] is None
        assert (await avatar_client.get(f"/api/v1/users/{uid}/avatar", headers=auth)).status_code == 404

    async def test_rejects_bad_uploads(self, avatar_client: AsyncClient, admin_auth) -> None:
        _uid, auth = await _viewer(avatar_client, admin_auth)

        text = await avatar_client.put(
            "/api/v1/users/me/avatar", files={"file": ("a.png", b"not an image", "image/png")}, headers=auth
        )
        assert text.status_code == 415, text.text

        gif = await avatar_client.put(
            "/api/v1/users/me/avatar", files={"file": ("a.gif", _image("GIF"), "image/gif")}, headers=auth
        )
        assert gif.status_code == 415, gif.text

        big = await avatar_client.put(
            "/api/v1/users/me/avatar",
            files={"file": ("a.png", b"\x89PNG" + b"0" * (2 * 1024 * 1024 + 10), "image/png")},
            headers=auth,
        )
        assert big.status_code == 413, big.text

    async def test_admin_sets_another_users_picture(self, avatar_client: AsyncClient, admin_auth) -> None:
        uid, auth = await _viewer(avatar_client, admin_auth)
        resp = await avatar_client.put(
            f"/api/v1/users/{uid}/avatar",
            files={"file": ("x.jpg", _image("JPEG"), "image/jpeg")},
            headers=admin_auth,
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["avatar_url"]
        assert (await avatar_client.get(f"/api/v1/users/{uid}/avatar", headers=auth)).status_code == 200

        missing = await avatar_client.put(
            f"/api/v1/users/{uuid.uuid4()}/avatar",
            files={"file": ("x.jpg", _image("JPEG"), "image/jpeg")},
            headers=admin_auth,
        )
        assert missing.status_code == 404, missing.text

    async def test_viewer_cannot_set_another_users_picture(self, avatar_client: AsyncClient, admin_auth) -> None:
        target, _ = await _viewer(avatar_client, admin_auth)
        _other, other_auth = await _viewer(avatar_client, admin_auth)
        resp = await avatar_client.put(
            f"/api/v1/users/{target}/avatar",
            files={"file": ("x.png", _image(), "image/png")},
            headers=other_auth,
        )
        assert resp.status_code == 403, resp.text

    async def test_picture_needs_a_signed_in_user(self, avatar_client: AsyncClient, admin_auth) -> None:
        uid, _ = await _viewer(avatar_client, admin_auth)
        resp = await avatar_client.get(f"/api/v1/users/{uid}/avatar")
        assert resp.status_code in (401, 403), resp.text
