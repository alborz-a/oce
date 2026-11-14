"""Mizito photos are read from the bucket by key (no FUSE listing); the mount stays the fallback."""

import pytest
from fastapi import HTTPException

from app.modules.documents import object_store as os_


def test_logical_key_only_for_mizito_paths():
    assert os_.mizito_logical_key("/data/photos/mizito/general/chats/c1/files/a.jpg") == "general/chats/c1/files/a.jpg"
    assert os_.mizito_logical_key("/data/photos/other/a.jpg") is None
    assert os_.mizito_logical_key("s3:projects/p/site/a.jpg") is None
    assert os_.mizito_logical_key(None) is None


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
    assert os_.mizito_logical_key(bad) is None


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
    monkeypatch.setattr(os_, "_mizito_s3", lambda: _Backend(size=3))
    resp = await os_.mizito_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", "image/jpeg")
    assert resp is not None
    assert resp.headers["content-length"] == "3"
    assert resp.media_type == "image/jpeg"


async def test_missing_object_is_404(monkeypatch):
    monkeypatch.setattr(os_, "_mizito_s3", lambda: _Backend(exc=FileNotFoundError("x")))
    with pytest.raises(HTTPException) as exc:
        await os_.mizito_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", None)
    assert exc.value.status_code == 404


async def test_other_failure_falls_back_to_mount(monkeypatch):
    monkeypatch.setattr(os_, "_mizito_s3", lambda: _Backend(exc=RuntimeError("net down")))
    assert await os_.mizito_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", None) is None


async def test_no_credentials_falls_back(monkeypatch):
    monkeypatch.setattr(os_, "_mizito_s3", lambda: None)
    assert await os_.mizito_stream_response("/data/photos/mizito/g/a.jpg", "a.jpg", None) is None


async def test_non_mizito_path_untouched():
    assert await os_.mizito_stream_response("/data/photos/x/a.jpg", "a.jpg", None) is None
