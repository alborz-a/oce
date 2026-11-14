"""Imported photos are read from the bucket by key (no FUSE listing); the mount stays the fallback."""

import pytest
from fastapi import HTTPException

from app.modules.documents import object_store as os_


def test_logical_key_only_for_imported_paths():
    assert os_.imported_logical_key("/data/photos/mizito/general/chats/c1/files/a.jpg") == "general/chats/c1/files/a.jpg"
    assert os_.imported_logical_key("/data/photos/other/a.jpg") is None
    assert os_.imported_logical_key("s3:projects/p/site/a.jpg") is None
    assert os_.imported_logical_key(None) is None


@pytest.mark.parametrize(
    "bad",
    [
        "/data/photos/mizito/",
        "/data/photos/mizito/../etc/passwd",
        "/data/photos/mizito/a/../../b",
        "/data/photos/mizito//abs",
        "/data/photos/mizito/a\\b",
    ],
)
def test_logical_key_rejects_traversal(bad):
    assert os_.imported_logical_key(bad) is None


class _Backend:
    def __init__(self, size=None, exc=None):
        self._size, self._exc = size, exc

    async def size(self, key):
        if self._exc:
            raise self._exc
        return self._size

    async def open_stream(self, key):
        yield b"abc"


async def test_streams_from_bucket(monkeypatch):
    monkeypatch.setattr(os_, "_imported_s3", lambda: _Backend(size=3))
    resp = await os_.imported_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", "image/jpeg")
    assert resp is not None
    assert resp.headers["content-length"] == "3"
    assert resp.media_type == "image/jpeg"


async def test_missing_object_is_404(monkeypatch):
    monkeypatch.setattr(os_, "_imported_s3", lambda: _Backend(exc=FileNotFoundError("x")))
    with pytest.raises(HTTPException) as exc:
        await os_.imported_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", None)
    assert exc.value.status_code == 404


async def test_other_failure_falls_back_to_mount(monkeypatch):
    monkeypatch.setattr(os_, "_imported_s3", lambda: _Backend(exc=RuntimeError("net down")))
    assert await os_.imported_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", None) is None


async def test_no_credentials_falls_back(monkeypatch):
    monkeypatch.setattr(os_, "_imported_s3", lambda: None)
    assert await os_.imported_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", None) is None


async def test_non_imported_path_untouched():
    assert await os_.imported_stream_response("/data/photos/x/a.jpg", "a.jpg", None) is None


# ── presigned URLs ──────────────────────────────────────────────────────


class _PresignBackend(_Backend):
    def __init__(self, size=5, exc=None, thumb_exists=False):
        super().__init__(size=size, exc=exc)
        self.thumb_exists = thumb_exists
        self.put_calls = []
        self.url_kwargs = None

    async def exists(self, key):
        return self.thumb_exists

    async def get(self, key):
        return b"src"

    async def put(self, key, data, content_type=None):
        self.put_calls.append((key, data, content_type))

    def url_for(self, key, **kw):
        self.url_kwargs = kw
        return f"https://bucket.example/{key}?sig=x"


async def test_presigned_url_for_imported_photo(monkeypatch):
    be = _PresignBackend()
    monkeypatch.setattr(os_, "_imported_s3", lambda: be)
    url = await os_.photo_presigned_url("/data/photos/mizito/g/a.jpg", "a.jpg", "image/jpeg")
    assert url == "https://bucket.example/g/a.jpg?sig=x"
    assert be.url_kwargs["expires_in"] == 600
    assert be.url_kwargs["response_content_type"] == "image/jpeg"
    assert be.url_kwargs["response_content_disposition"].startswith("inline;")


async def test_presign_missing_object_is_404(monkeypatch):
    monkeypatch.setattr(os_, "_imported_s3", lambda: _PresignBackend(exc=FileNotFoundError("x")))
    with pytest.raises(HTTPException) as exc:
        await os_.photo_presigned_url("/data/photos/mizito/g/a.jpg", "a.jpg", None)
    assert exc.value.status_code == 404


async def test_presign_falls_back_when_not_bucket_backed_or_s3_down(monkeypatch):
    assert await os_.photo_presigned_url("/data/photos/local/a.jpg", "a.jpg", None) is None
    monkeypatch.setattr(os_, "_imported_s3", lambda: _PresignBackend(exc=RuntimeError("net")))
    assert await os_.photo_presigned_url("/data/photos/mizito/g/a.jpg", "a.jpg", None) is None


async def test_thumb_made_and_stored_once(monkeypatch):
    be = _PresignBackend()
    monkeypatch.setattr(os_, "_imported_s3", lambda: be)

    def fake_thumb(source, dest):
        dest.write_bytes(b"jpegthumb")
        return True

    monkeypatch.setattr("app.modules.documents.service._generate_photo_thumbnail", fake_thumb)
    url = await os_.photo_thumb_presigned_url("p1", "/data/photos/mizito/g/a.jpg")
    assert url == "https://bucket.example/_thumbs/p1.jpg?sig=x"
    assert be.put_calls == [("_thumbs/p1.jpg", b"jpegthumb", "image/jpeg")]
    be.thumb_exists = True
    be.put_calls.clear()
    assert await os_.photo_thumb_presigned_url("p1", "/data/photos/mizito/g/a.jpg") is not None
    assert be.put_calls == []


async def test_thumb_failure_returns_none(monkeypatch):
    be = _PresignBackend()
    monkeypatch.setattr(os_, "_imported_s3", lambda: be)
    monkeypatch.setattr("app.modules.documents.service._generate_photo_thumbnail", lambda s, d: False)
    assert await os_.photo_thumb_presigned_url("p1", "/data/photos/mizito/g/a.jpg") is None
    assert be.put_calls == []
