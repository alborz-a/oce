"""Unit tests for profile picture validation and storage (no database)."""

from __future__ import annotations

import io
import uuid

import pytest
from fastapi import HTTPException
from PIL import Image

from app.modules.users import avatar


def _img(fmt: str, size=(640, 360), mode="RGB") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, (10, 120, 200)[: len(mode)]).save(buf, format=fmt)
    return buf.getvalue()


@pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP"])
def test_accepts_allowed_formats_and_resizes_to_256_square(fmt: str) -> None:
    out = avatar.process_avatar(_img(fmt))
    with Image.open(io.BytesIO(out)) as img:
        assert img.format == "WEBP"
        assert img.size == (256, 256)


def test_keeps_transparency_for_png() -> None:
    buf = io.BytesIO()
    Image.new("RGBA", (64, 64), (10, 120, 200, 100)).save(buf, format="PNG")
    out = avatar.process_avatar(buf.getvalue())
    with Image.open(io.BytesIO(out)) as img:
        assert "A" in img.getbands()


@pytest.mark.parametrize("raw", [b"", b"plain text", _img("GIF"), _img("BMP")], ids=["empty", "text", "gif", "bmp"])
def test_rejects_non_allowed_content(raw: bytes) -> None:
    with pytest.raises(HTTPException) as exc:
        avatar.process_avatar(raw)
    assert exc.value.status_code in (415, 422)


def test_rejects_over_2mb() -> None:
    with pytest.raises(HTTPException) as exc:
        avatar.process_avatar(b"\x89PNG" + b"0" * (avatar.MAX_AVATAR_BYTES + 1))
    assert exc.value.status_code == 413


def test_store_overwrites_and_remove_deletes(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.core.storage.resolve_data_dir", lambda: tmp_path)
    uid = uuid.uuid4()
    rel = avatar.store_avatar(uid, _img("PNG"))
    assert rel == f"avatars/{uid}.webp"
    assert avatar.avatar_file(rel).is_file()
    avatar.store_avatar(uid, _img("JPEG"))  # replacement keeps one file
    assert len(list((tmp_path / "avatars").iterdir())) == 1
    avatar.remove_avatar_file(rel)
    assert not avatar.avatar_file(rel).exists()


def test_path_cannot_escape_data_dir(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.core.storage.resolve_data_dir", lambda: tmp_path)
    with pytest.raises(HTTPException):
        avatar.avatar_file("../../etc/passwd")
