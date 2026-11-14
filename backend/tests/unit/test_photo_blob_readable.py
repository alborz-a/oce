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
