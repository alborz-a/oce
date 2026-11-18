"""Presigned URL route for imported Mizito general-chat files (documents router)."""

import pytest
from fastapi import HTTPException

from app.modules.documents import object_store, router as documents_router

VALID_KEY = "mizito/general/chats/room-1/files/photo one.jpg"


class _FakeBackend:
    def __init__(self) -> None:
        self.calls: list[tuple[str, int]] = []

    def url_for(self, key: str, expires_in: int, **_: object) -> str:
        self.calls.append((key, expires_in))
        return f"https://bucket.example/{key}?sig=x"


@pytest.fixture
def fake_backend(monkeypatch: pytest.MonkeyPatch) -> _FakeBackend:
    backend = _FakeBackend()
    monkeypatch.setattr(object_store, "_imported_s3", lambda: backend)
    return backend


@pytest.mark.asyncio
async def test_valid_key_returns_presigned_url_without_prefix(fake_backend: _FakeBackend) -> None:
    res = await documents_router.chat_file_url(user_id="u", key=VALID_KEY)
    assert res.url is not None and res.url.startswith("https://bucket.example/general/chats/room-1/files/")
    assert fake_backend.calls == [("general/chats/room-1/files/photo one.jpg", object_store.PRESIGN_TTL_S)]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "key",
    [
        "mizito/general/chats/",
        "mizito/private/chats/room/files/a.jpg",
        "general/chats/room/files/a.jpg",
        "/mizito/general/chats/room/files/a.jpg",
    ],
)
async def test_bad_prefix_rejected(fake_backend: _FakeBackend, key: str) -> None:
    with pytest.raises(HTTPException) as exc:
        await documents_router.chat_file_url(user_id="u", key=key)
    assert exc.value.status_code == 400
    assert fake_backend.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "key",
    [
        "mizito/general/chats/room/files/../../secret.jpg",
        "mizito/general/chats/room//files/a.jpg",
        "mizito/general/chats/room\\files\\a.jpg",
        "mizito/general/chats/room/files/a\x00.jpg",
        "mizito/general/chats/room/files/a\n.jpg",
    ],
)
async def test_traversal_and_control_chars_rejected(fake_backend: _FakeBackend, key: str) -> None:
    with pytest.raises(HTTPException) as exc:
        await documents_router.chat_file_url(user_id="u", key=key)
    assert exc.value.status_code == 400
    assert fake_backend.calls == []


def test_route_requires_login_dependency() -> None:
    # Unauthenticated calls get 401 from CurrentUserId; the route also carries the documents.read permission gate.
    route = next(r for r in documents_router.router.routes if getattr(r, "path", "").endswith("/chat-file-url/"))
    assert route.dependencies, "chat-file-url must declare RequirePermission dependency"
