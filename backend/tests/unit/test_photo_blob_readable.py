"""A photo blob that exists but cannot be read answers 503, never an unhandled 500."""

import pytest
from fastapi import HTTPException

from app.modules.documents.router import _ensure_blob_readable


def test_readable_blob_passes(tmp_path):
    f = tmp_path / "a.jpg"
    f.write_bytes(b"x")
    _ensure_blob_readable(f)


def test_unreadable_blob_is_503(tmp_path):
    # A directory fails open() with an OSError, like an Errno 5 on the bucket mount.
    with pytest.raises(HTTPException) as exc:
        _ensure_blob_readable(tmp_path)
    assert exc.value.status_code == 503


def test_resolve_blob_io_error_is_503(tmp_path, monkeypatch):
    from pathlib import Path

    from app.modules.documents import router as r

    base = tmp_path / "photos"
    base.mkdir()
    real_is_file = Path.is_file

    def boom(self):
        if self.name == "x.jpg":
            raise OSError(5, "Input/output error")
        return real_is_file(self)

    monkeypatch.setattr(Path, "is_file", boom)
    with pytest.raises(HTTPException) as exc:
        r._resolve_photo_blob(str(tmp_path / "other" / "photos" / "x.jpg"), base, ("photos",))
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_hung_blob_call_is_503_and_loop_stays_responsive(monkeypatch):
    import asyncio
    import threading

    from app.modules.documents import router as r

    release = threading.Event()
    monkeypatch.setattr(r, "_BLOB_IO_TIMEOUT_S", 0.2)
    try:
        ticks = 0

        async def ticker():
            nonlocal ticks
            while True:
                ticks += 1
                await asyncio.sleep(0.02)

        t = asyncio.create_task(ticker())
        with pytest.raises(HTTPException) as exc:
            await r._blob_io(lambda: release.wait(5))
        t.cancel()
        assert exc.value.status_code == 503
        assert ticks > 3  # the event loop kept running while the call hung
    finally:
        release.set()


@pytest.mark.asyncio
async def test_blob_pool_sheds_load_when_full(monkeypatch):
    from app.modules.documents import router as r

    monkeypatch.setattr(r, "_blob_inflight", r._BLOB_IO_MAX_INFLIGHT)
    with pytest.raises(HTTPException) as exc:
        await r._blob_io(lambda: None)
    assert exc.value.status_code == 503


async def test_blob_file_response_small_file_is_read_in_pool(tmp_path):
    from app.modules.documents import router as r

    f = tmp_path / "a.jpg"
    f.write_bytes(b"jpegbytes")
    resp = await r._blob_file_response(f, media_type="image/jpeg", filename="a.jpg", headers={"Cache-Control": "x"})
    assert resp.body == b"jpegbytes"
    assert resp.media_type == "image/jpeg"
    assert resp.headers["content-disposition"].startswith("attachment")
    assert resp.headers["cache-control"] == "x"


async def test_blob_file_response_big_file_falls_back_to_file_response(tmp_path, monkeypatch):
    from fastapi.responses import FileResponse

    from app.modules.documents import router as r

    f = tmp_path / "big.jpg"
    f.write_bytes(b"x" * 10)
    monkeypatch.setattr(r, "_BLOB_INLINE_MAX_BYTES", 5)
    resp = await r._blob_file_response(f, media_type="image/jpeg", filename="big.jpg")
    assert isinstance(resp, FileResponse)


async def test_blob_file_response_stalled_stat_is_503(tmp_path, monkeypatch):
    import threading

    from app.modules.documents import router as r

    gate = threading.Event()
    monkeypatch.setattr(r, "_BLOB_IO_TIMEOUT_S", 0.2)
    monkeypatch.setattr(r.os, "stat", lambda *_a, **_k: gate.wait(5))
    try:
        with pytest.raises(HTTPException) as exc:
            await r._blob_file_response(tmp_path / "x.jpg", media_type="image/jpeg")
        assert exc.value.status_code == 503
    finally:
        gate.set()
