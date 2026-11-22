# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Project picture (avatar) storage helpers.

Bytes go to the object store under ``projects/<id>/picture.<ext>``. Reads are
served only as presigned URLs (S3); on local storage no URL is produced and the
UI falls back to initials. Bytes are never proxied through the API.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException, UploadFile, status

from app.core.file_signature import detect
from app.core.storage import get_storage_backend

logger = logging.getLogger(__name__)

MAX_PICTURE_BYTES = 5 * 1024 * 1024
PRESIGN_EXPIRES_IN = 3600

# detect() kind -> (file extension, MIME type)
_ALLOWED: dict[str, tuple[str, str]] = {
    "png": ("png", "image/png"),
    "jpeg": ("jpg", "image/jpeg"),
    "webp": ("webp", "image/webp"),
}


def picture_key(project_id: uuid.UUID | str, ext: str) -> str:
    return f"projects/{project_id}/picture.{ext}"


def presigned_picture_url(key: str, *, content_type: str | None = None) -> str | None:
    """Presigned GET URL for ``key``; None when the backend cannot presign (local)."""
    try:
        return get_storage_backend().url_for(
            key,
            expires_in=PRESIGN_EXPIRES_IN,
            response_content_type=content_type,
        )
    except Exception as exc:  # noqa: BLE001 - a broken presign must not break the project read
        logger.warning("Project picture presign failed key=%s: %s", key, exc)
        return None


async def read_validated_picture(file: UploadFile) -> tuple[bytes, str, str]:
    """Read the upload and validate size and magic bytes.

    Returns ``(content, ext, mime)``. Raises 413 over 5 MB, 415 for anything
    other than PNG, JPEG or WebP (by signature, not by filename or client MIME).
    """
    content = await file.read(MAX_PICTURE_BYTES + 1)
    if len(content) > MAX_PICTURE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="picture_too_large:max_5mb",
        )
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="picture_empty")
    kind = detect(content[:32])
    if kind not in _ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="picture_type_not_supported:png_jpg_webp_only",
        )
    ext, mime = _ALLOWED[kind]
    return content, ext, mime


async def store_picture(
    project_id: uuid.UUID,
    file: UploadFile,
    previous_key: str | None,
) -> str:
    """Validate and store the picture; remove a previous key with another extension."""
    content, ext, _mime = await read_validated_picture(file)
    key = picture_key(project_id, ext)
    backend = get_storage_backend()
    await backend.put(key, content)
    if previous_key and previous_key != key:
        await _safe_delete(previous_key)
    return key


async def remove_picture(key: str | None) -> None:
    if key:
        await _safe_delete(key)


async def _safe_delete(key: str) -> None:
    try:
        await get_storage_backend().delete(key)
    except Exception as exc:  # noqa: BLE001 - orphan blob must not block the DB update
        logger.warning("Project picture delete failed key=%s: %s", key, exc)
