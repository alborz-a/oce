"""Profile picture storage for users.

Files live under ``<data dir>/avatars/<user_id>.webp``. Uploads are validated
(JPEG / PNG / WebP, at most 2 MB), cropped to a square, resized to 256 px and
re-encoded as WebP, which also strips EXIF metadata. Always writing the same
file name means a replacement overwrites the old picture.
"""

from __future__ import annotations

import io
import uuid
from pathlib import Path

from fastapi import HTTPException, status

MAX_AVATAR_BYTES = 2 * 1024 * 1024
AVATAR_SIZE = 256
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
AVATAR_MEDIA_TYPE = "image/webp"


def avatars_dir() -> Path:
    from app.core.storage import resolve_data_dir

    return Path(resolve_data_dir()) / "avatars"


def avatar_rel_path(user_id: uuid.UUID) -> str:
    return f"avatars/{user_id}.webp"


def avatar_file(rel_path: str) -> Path:
    """Absolute path for a stored relative path, confined to the avatars dir."""
    from app.core.storage import resolve_data_dir

    base = Path(resolve_data_dir()).resolve()
    full = (base / rel_path).resolve()
    if base not in full.parents:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return full


def process_avatar(raw: bytes) -> bytes:
    """Validate an uploaded image and return the 256 px WebP bytes."""
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty file")
    if len(raw) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Avatar must be 2 MB or smaller")
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(raw)) as probe:
            fmt = probe.format
            probe.verify()
        if fmt not in ALLOWED_FORMATS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Avatar must be a JPEG, PNG or WebP image",
            )
        with Image.open(io.BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
            img = ImageOps.fit(img, (AVATAR_SIZE, AVATAR_SIZE), method=Image.Resampling.LANCZOS)
            out = io.BytesIO()
            img.save(out, format="WEBP", quality=85)
            return out.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Avatar must be a valid JPEG, PNG or WebP image",
        ) from exc


def store_avatar(user_id: uuid.UUID, raw: bytes) -> str:
    """Process and write the picture; return the relative path to store."""
    data = process_avatar(raw)
    rel = avatar_rel_path(user_id)
    target = avatar_file(rel)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".tmp")
    tmp.write_bytes(data)
    tmp.replace(target)
    return rel


def remove_avatar_file(rel_path: str | None) -> None:
    if not rel_path:
        return
    try:
        avatar_file(rel_path).unlink(missing_ok=True)
    except HTTPException:
        pass
