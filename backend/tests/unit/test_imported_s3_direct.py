"""Imported photos are read from the bucket by key (no FUSE listing); the mount stays the fallback."""

import asyncio

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
    assert "response_content_disposition" not in be.url_kwargs


async def test_photo_file_presign_passes_no_content_disposition(monkeypatch):
    # Same bug as the thumb presign: a second Content-Disposition breaks the lightbox image in Chrome.
    be = _PresignBackend()
    monkeypatch.setattr(os_, "_imported_s3", lambda: be)
    assert await os_.photo_presigned_url("/data/photos/mizito/g/a.jpg", "a.jpg", "image/jpeg") is not None
    assert "response_content_disposition" not in be.url_kwargs
    assert be.url_kwargs["response_content_type"] == "image/jpeg"


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


async def test_thumb_presign_passes_no_content_disposition(monkeypatch):
    # The bucket gateway adds its own Content-Disposition. Passing ResponseContentDisposition too
    # sends two headers, and Chrome blocks the image (ERR_RESPONSE_HEADERS_MULTIPLE_CONTENT_DISPOSITION).
    be = _PresignBackend(thumb_exists=True)
    monkeypatch.setattr(os_, "_imported_s3", lambda: be)
    assert await os_.photo_thumb_presigned_url("p1", "/data/photos/mizito/g/a.jpg") is not None
    assert "response_content_disposition" not in be.url_kwargs
    assert be.url_kwargs["response_content_type"] == "image/jpeg"


class _SingleFlightBackend:
    def __init__(self):
        self.stored = set()
        self.put_calls = 0

    async def exists(self, key):
        return key in self.stored

    async def size(self, key):
        return 3

    async def get(self, key):
        await asyncio.sleep(0)  # let the other callers queue on the thumb lock
        return b"abc"

    async def put(self, key, data, content_type=None):
        self.stored.add(key)
        self.put_calls += 1

    def url_for(self, key, **kwargs):
        return f"https://bucket.example/{key}"


async def test_concurrent_first_views_build_thumb_once(monkeypatch):
    be = _SingleFlightBackend()
    monkeypatch.setattr(os_, "_imported_s3", lambda: be)
    builds = []

    def fake_thumb(source, dest):
        builds.append(1)
        dest.write_bytes(b"jpegthumb")
        return True

    monkeypatch.setattr("app.modules.documents.service._generate_photo_thumbnail", fake_thumb)
    urls = await asyncio.gather(
        *(os_.photo_thumb_presigned_url("p9", "/data/photos/mizito/g/a.jpg") for _ in range(5))
    )
    assert len(builds) == 1
    assert be.put_calls == 1
    assert urls == ["https://bucket.example/_thumbs/p9.jpg"] * 5
    assert os_._THUMB_BUILD_LOCKS == {}


async def test_s3_photo_presigns_omit_content_disposition(monkeypatch):
    # Direct s3: photos must also omit ResponseContentDisposition so bucket gateways do not emit duplicates.
    be = _PresignBackend(thumb_exists=True)
    monkeypatch.setattr(os_, "get_storage_backend", lambda: be)

    full_url = await os_.photo_presigned_url("s3:projects/p1/site/a.jpg", "a.jpg", "image/jpeg")
    assert full_url == "https://bucket.example/projects/p1/site/a.jpg?sig=x"
    assert "response_content_disposition" not in be.url_kwargs
    assert be.url_kwargs["response_content_type"] == "image/jpeg"

    be.url_kwargs = None
    thumb_url = await os_.photo_thumb_presigned_url("p2", "s3:projects/p1/site/a.jpg")
    assert thumb_url == "https://bucket.example/_thumbs/p2.jpg?sig=x"
    assert "response_content_disposition" not in be.url_kwargs
    assert be.url_kwargs["response_content_type"] == "image/jpeg"


def test_s3_backend_url_for_omits_response_content_disposition_when_unset(monkeypatch):
    import sys
    import types
    from app.core.storage import S3StorageBackend

    captured: dict = {}

    class _FakeClient:
        def generate_presigned_url(self, op, Params, ExpiresIn):
            captured["op"] = op
            captured["params"] = dict(Params)
            captured["expires_in"] = ExpiresIn
            return "https://bucket.example/presigned"

    fake_aioboto3 = types.ModuleType("aioboto3")
    fake_boto3 = types.ModuleType("boto3")
    fake_boto3.client = lambda *a, **kw: _FakeClient()  # type: ignore[attr-defined]
    fake_botocore = types.ModuleType("botocore")
    fake_botocore_cfg = types.ModuleType("botocore.config")
    fake_botocore_cfg.Config = lambda **kw: kw  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "aioboto3", fake_aioboto3)
    monkeypatch.setitem(sys.modules, "boto3", fake_boto3)
    monkeypatch.setitem(sys.modules, "botocore", fake_botocore)
    monkeypatch.setitem(sys.modules, "botocore.config", fake_botocore_cfg)

    backend = S3StorageBackend(
        endpoint="https://s3.example.test",
        access_key="k",
        secret_key="s",
        bucket="photos",
        region="us-east-1",
    )
    url = backend.url_for("projects/p1/a.jpg", expires_in=600, response_content_type="image/jpeg")
    assert url == "https://bucket.example/presigned"
    assert captured["op"] == "get_object"
    assert captured["params"] == {
        "Bucket": "photos",
        "Key": "projects/p1/a.jpg",
        "ResponseContentType": "image/jpeg",
    }
    assert "ResponseContentDisposition" not in captured["params"]
