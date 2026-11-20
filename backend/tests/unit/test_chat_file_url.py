"""Presigned URL route for imported Mizito general-chat files (documents router)."""

import uuid

import pytest
from fastapi import HTTPException

from app.modules.documents import object_store, router as documents_router

VALID_KEY = "mizito/general/chats/room-1/files/photo one.jpg"
PROJECT_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
PROJECT_B = uuid.UUID("22222222-2222-2222-2222-222222222222")


class _FakeBackend:
    def __init__(self) -> None:
        self.calls: list[tuple[str, int]] = []

    def url_for(self, key: str, expires_in: int, **_: object) -> str:
        self.calls.append((key, expires_in))
        return f"https://bucket.example/{key}?sig=x"


class _FakeResult:
    def __init__(self, rows: list[uuid.UUID]) -> None:
        self._rows = rows

    def scalars(self) -> "_FakeResult":
        return self

    def all(self) -> list[uuid.UUID]:
        return list(self._rows)


class _FakeSession:
    """Returns the project ids of the photo rows mapped to the key; records the statements run."""

    def __init__(self, project_ids: list[uuid.UUID]) -> None:
        self._project_ids = project_ids
        self.statements: list[object] = []

    async def execute(self, stmt: object) -> _FakeResult:
        self.statements.append(stmt)
        return _FakeResult(self._project_ids)


@pytest.fixture
def fake_backend(monkeypatch: pytest.MonkeyPatch) -> _FakeBackend:
    backend = _FakeBackend()
    monkeypatch.setattr(object_store, "_imported_s3", lambda: backend)
    return backend


def _patch_access(monkeypatch: pytest.MonkeyPatch, allowed: set[uuid.UUID], admin: bool = False) -> None:
    """Fake project membership: projects outside ``allowed`` raise 403 like verify_project_access does for non-members."""

    async def fake_verify(project_id: uuid.UUID, user_id: str, session: object, *, manager_read: bool = False) -> None:
        if admin:  # real verify_project_access returns early for admin role
            return
        if project_id not in allowed:
            raise HTTPException(status_code=403, detail="Forbidden")

    async def fake_admin(session: object, user_id: str | None) -> bool:
        return admin

    monkeypatch.setattr(documents_router, "verify_project_access", fake_verify)
    monkeypatch.setattr(documents_router, "viewer_is_system_admin", fake_admin)


@pytest.mark.asyncio
async def test_member_gets_presigned_url_without_prefix(
    fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_access(monkeypatch, allowed={PROJECT_A})
    session = _FakeSession([PROJECT_A])
    res = await documents_router.chat_file_url(user_id="u", session=session, key=VALID_KEY)
    assert res.url is not None and res.url.startswith("https://bucket.example/general/chats/room-1/files/")
    assert fake_backend.calls == [("general/chats/room-1/files/photo one.jpg", object_store.PRESIGN_TTL_S)]
    # The lookup maps the key to the stored file_path form.
    params = session.statements[0].compile().params  # type: ignore[attr-defined]
    assert "/data/photos/" + VALID_KEY in params.values()


@pytest.mark.asyncio
async def test_non_member_gets_403_and_no_url(fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_access(monkeypatch, allowed=set())
    with pytest.raises(HTTPException) as exc:
        await documents_router.chat_file_url(user_id="u", session=_FakeSession([PROJECT_A]), key=VALID_KEY)
    assert exc.value.status_code == 403
    assert fake_backend.calls == []


@pytest.mark.asyncio
async def test_member_of_any_matching_project_passes(
    fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_access(monkeypatch, allowed={PROJECT_B})
    res = await documents_router.chat_file_url(user_id="u", session=_FakeSession([PROJECT_A, PROJECT_B]), key=VALID_KEY)
    assert res.url is not None
    assert len(fake_backend.calls) == 1


@pytest.mark.asyncio
async def test_admin_passes_for_mapped_key(fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_access(monkeypatch, allowed=set(), admin=True)
    res = await documents_router.chat_file_url(user_id="admin", session=_FakeSession([PROJECT_A]), key=VALID_KEY)
    assert res.url is not None


@pytest.mark.asyncio
async def test_unmapped_key_non_admin_gets_404(fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_access(monkeypatch, allowed={PROJECT_A}, admin=False)
    with pytest.raises(HTTPException) as exc:
        await documents_router.chat_file_url(user_id="u", session=_FakeSession([]), key=VALID_KEY)
    assert exc.value.status_code == 404
    assert fake_backend.calls == []


@pytest.mark.asyncio
async def test_unmapped_key_admin_passes_through_to_presign(
    fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_access(monkeypatch, allowed=set(), admin=True)
    res = await documents_router.chat_file_url(user_id="admin", session=_FakeSession([]), key=VALID_KEY)
    assert res.url is not None
    assert len(fake_backend.calls) == 1


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
async def test_bad_prefix_rejected(fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch, key: str) -> None:
    _patch_access(monkeypatch, allowed={PROJECT_A})
    with pytest.raises(HTTPException) as exc:
        await documents_router.chat_file_url(user_id="u", session=_FakeSession([PROJECT_A]), key=key)
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
async def test_traversal_and_control_chars_rejected(
    fake_backend: _FakeBackend, monkeypatch: pytest.MonkeyPatch, key: str
) -> None:
    _patch_access(monkeypatch, allowed={PROJECT_A}, admin=True)
    session = _FakeSession([PROJECT_A])
    with pytest.raises(HTTPException) as exc:
        await documents_router.chat_file_url(user_id="u", session=session, key=key)
    assert exc.value.status_code == 400
    assert fake_backend.calls == []
    assert session.statements == []


def test_route_requires_login_dependency() -> None:
    # Unauthenticated calls get 401 from CurrentUserId; the route also carries the documents.read permission gate.
    route = next(r for r in documents_router.router.routes if getattr(r, "path", "").endswith("/chat-file-url/"))
    assert route.dependencies, "chat-file-url must declare RequirePermission dependency"
