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
