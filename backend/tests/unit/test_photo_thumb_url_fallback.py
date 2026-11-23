"""thumb-url must never 500: a thumbnail/storage failure falls back to the full photo URL or a null url (200)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.modules.documents import object_store as os_
from app.modules.documents import router as doc_router

PHOTO_PATH = "/data/photos/mizito/g/a.jpg"


class _BrokenBackend:
    """Storage whose every call fails the way a broken bucket does."""

    def exists(self, key):
        raise ConnectionError("bucket down")

    def size(self, key):
        raise ConnectionError("bucket down")

    def url_for(self, key, **kwargs):
        raise RuntimeError("presign failed")


class _MissingThumbBackend:
    """Thumb key absent, thumb build fails, but the original photo is presignable."""

    def __init__(self):
        self.url_kwargs = {}

    async def exists(self, key):
        return False

    async def size(self, key):
        return 10

    async def get(self, key):
        return b"source"

    async def put(self, key, data, content_type=None):
        raise ConnectionError("put failed")

    def url_for(self, key, **kwargs):
        self.url_kwargs[key] = kwargs
        return f"https://bucket.example/{key}?sig=full"


def _photo():
    return SimpleNamespace(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        file_path=PHOTO_PATH,
        filename="a.jpg",
    )


class _Service:
    def __init__(self, photo):
        self._photo = photo

    async def get_photo(self, photo_id):
        return self._photo


async def _no_access(*args, **kwargs):
    return None


@pytest.fixture(autouse=True)
def _no_project_check(monkeypatch):
    monkeypatch.setattr(doc_router, "verify_project_access", _no_access)


async def test_thumb_storage_error_returns_none_not_raise(monkeypatch):
    monkeypatch.setattr(os_, "_imported_s3", lambda: _BrokenBackend())
    assert await os_.photo_thumb_presigned_url("p1", PHOTO_PATH) is None


async def test_thumb_backend_unconfigured_returns_none(monkeypatch):
    def _boom():
        raise RuntimeError("storage not configured")

    monkeypatch.setattr(os_, "_imported_s3", _boom)
    assert await os_.photo_thumb_presigned_url("p1", PHOTO_PATH) is None


async def test_thumb_url_falls_back_to_full_photo_when_thumb_missing(monkeypatch):
    be = _MissingThumbBackend()
    monkeypatch.setattr(os_, "_imported_s3", lambda: be)
    monkeypatch.setattr(
        "app.modules.documents.service._generate_photo_thumbnail",
        lambda source, dest: False,
    )
    photo = _photo()
    resp = await doc_router.photo_thumb_url(
        photo.id, uuid.uuid4(), session=None, service=_Service(photo)
    )
    assert resp.url == "https://bucket.example/g/a.jpg?sig=full"


async def test_thumb_url_storage_error_is_200_not_500(monkeypatch):
    monkeypatch.setattr(os_, "_imported_s3", lambda: _BrokenBackend())
    photo = _photo()
    resp = await doc_router.photo_thumb_url(
        photo.id, uuid.uuid4(), session=None, service=_Service(photo)
    )
    # Both presigns failed: the caller gets a null url and goes through the API proxy.
    assert resp.url is None


async def test_thumb_url_unexpected_thumb_exception_is_caught(monkeypatch):
    async def _raise(*args, **kwargs):
        raise ValueError("unexpected")

    monkeypatch.setattr(os_, "photo_thumb_presigned_url", _raise)
    monkeypatch.setattr(os_, "photo_presigned_url", lambda *a, **k: _ok_url())
    photo = _photo()
    resp = await doc_router.photo_thumb_url(
        photo.id, uuid.uuid4(), session=None, service=_Service(photo)
    )
    assert resp.url == "https://bucket.example/full.jpg"


async def _ok_url():
    return "https://bucket.example/full.jpg"
