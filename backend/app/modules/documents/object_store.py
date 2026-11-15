"""Object-storage helpers for documents and photos.

When ``storage_backend == "s3"`` new files are written through the storage backend and the row's
``file_path`` holds ``"s3:" + <logical key>`` (the backend adds the configured ``S3_KEY_PREFIX``, so the
bucket key is ``<prefix><logical key>``). Rows with an old local path keep working unchanged.
"""

from __future__ import annotations

import logging
import mimetypes
import uuid
from urllib.parse import quote

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.storage import get_storage_backend

logger = logging.getLogger(__name__)

S3_PATH_PREFIX = "s3:"


def is_object_path(file_path: str | None) -> bool:
    """True when ``file_path`` points at object storage rather than the local disk."""
    return bool(file_path) and str(file_path).startswith(S3_PATH_PREFIX)


def key_of(file_path: str) -> str:
    return str(file_path)[len(S3_PATH_PREFIX) :]


def s3_enabled() -> bool:
    from app.config import get_settings

    return (getattr(get_settings(), "storage_backend", "local") or "local").lower() == "s3"


def build_key(project_id: uuid.UUID | str, category: str, storage_name: str) -> str:
    """Logical key ``projects/<project>/<category>/<uuid>_<name>`` (the backend prepends the prefix)."""
    return f"projects/{project_id}/{category or 'other'}/{storage_name}"


def key_in_scope(key: str, project_id: uuid.UUID | str | None = None) -> bool:
    """A logical key must be a clean relative ``projects/...`` key (optionally for one project)."""
    if not key or key.startswith("/") or "\\" in key or ".." in key.split("/"):
        return False
    if not key.startswith("projects/"):
        return False
    return project_id is None or key.startswith(f"projects/{project_id}/")


async def put_object(key: str, content: bytes) -> None:
    await get_storage_backend().put(key, content)


async def object_exists(key: str) -> bool:
    return await get_storage_backend().exists(key)


async def object_size(key: str) -> int:
    return await get_storage_backend().size(key)


def _content_disposition(filename: str, attachment: bool) -> str:
    kind = "attachment" if attachment else "inline"
    ascii_name = filename.encode("ascii", "ignore").decode() or "download"
    ascii_name = ascii_name.replace('"', "")
    return f"{kind}; filename=\"{ascii_name}\"; filename*=utf-8''{quote(filename)}"


async def stream_response(
    file_path: str,
    filename: str,
    media_type: str | None,
    *,
    attachment: bool = True,
    headers: dict[str, str] | None = None,
) -> StreamingResponse:
    """Stream an ``s3:`` document through the backend (bytes never touch the local disk)."""
    key = key_of(file_path)
    backend = get_storage_backend()
    try:
        size = await backend.size(key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage") from exc
    out = {
        "Content-Length": str(size),
        "Content-Disposition": _content_disposition(filename or "download", attachment),
    }
    out.update(headers or {})
    mt = media_type or mimetypes.guess_type(filename or "")[0] or "application/octet-stream"
    return StreamingResponse(backend.open_stream(key), media_type=mt, headers=out)


# ── Imported photos: read straight from the bucket ──────────────────────
#
# Imported photos keep ``file_path = /data/photos/mizito/<bucket key under mizito/>``. That
# folder is an rclone FUSE mount of the same bucket, and a lookup in a cold chat folder waits for the
# bucket's LIST (~100 s). GetObject/HeadObject by key needs no listing, so serve through S3 first
# and leave the mount as the fallback.

IMPORTED_LOCAL_PREFIX = "/data/photos/mizito/"
IMPORTED_KEY_PREFIX = "mizito"
_IMPORTED_S3_TIMEOUT_S = 20.0
_imported_backend: object | None = None


def imported_logical_key(file_path: str | None) -> str | None:
    """Key under ``mizito/`` (the import key prefix) for an imported photo path, or None for any other path or an unsafe one."""
    if not file_path or not str(file_path).startswith(IMPORTED_LOCAL_PREFIX):
        return None
    rest = str(file_path)[len(IMPORTED_LOCAL_PREFIX) :]
    if not rest or rest.startswith("/") or "\\" in rest or ".." in rest.split("/"):
        return None
    return rest


def _imported_s3():
    """Lazy S3 backend rooted at ``mizito/`` (the import key prefix); None when the S3 credentials are not configured."""
    global _imported_backend
    if _imported_backend is None:
        from app.config import get_settings
        from app.core.storage import S3StorageBackend

        cfg = get_settings()
        if not (cfg.s3_access_key and cfg.s3_secret_key and cfg.s3_bucket):
            return None
        _imported_backend = S3StorageBackend(
            endpoint=cfg.s3_endpoint,
            access_key=cfg.s3_access_key,
            secret_key=cfg.s3_secret_key,
            bucket=cfg.s3_bucket,
            region=cfg.s3_region,
            key_prefix=IMPORTED_KEY_PREFIX,
        )
    return _imported_backend


async def imported_stream_response(
    file_path: str | None,
    filename: str,
    media_type: str | None,
    *,
    attachment: bool = True,
    headers: dict[str, str] | None = None,
) -> StreamingResponse | None:
    """Stream an imported photo from the bucket, or None to fall back to the mount.

    A missing object answers 404 (the bucket is the source of truth). Any other failure (credentials,
    network, timeout) returns None so the FUSE path still gets its chance. Keys and credentials are
    never logged.
    """
    import asyncio

    key = imported_logical_key(file_path)
    if key is None:
        return None
    try:
        backend = _imported_s3()
        if backend is None:
            return None
        size = await asyncio.wait_for(backend.size(key), timeout=_IMPORTED_S3_TIMEOUT_S)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage") from None
    except Exception as exc:  # noqa: BLE001 - fall back to the mount, never fail the request here
        logger.warning("imported-photo s3 head failed, falling back to mount: %s", type(exc).__name__)
        return None
    out = {
        "Content-Length": str(size),
        "Content-Disposition": _content_disposition(filename or "download", attachment),
    }
    out.update(headers or {})
    mt = media_type or mimetypes.guess_type(filename or "")[0] or "application/octet-stream"
    return StreamingResponse(backend.open_stream(key), media_type=mt, headers=out)


# ── Presigned photo URLs: the browser loads straight from the bucket ────
#
# The API and the bucket are in the same data centre, so proxying every picture through the API only
# adds a hop. After the normal permission check the photo routes hand out a short-lived presigned GET
# URL instead. The URL is a credential: never log it.

PRESIGN_TTL_S = 600
_THUMB_KEY_DIR = "_thumbs"
_THUMB_SOURCE_MAX_BYTES = 40 * 1024 * 1024


def _photo_backend_and_key(file_path: str | None):
    """(S3 backend, logical key) for an imported or ``s3:`` photo path, else (None, None)."""
    key = imported_logical_key(file_path)
    if key is not None:
        return _imported_s3(), key
    if file_path and is_object_path(file_path):
        return get_storage_backend(), key_of(file_path)
    return None, None


async def photo_presigned_url(file_path: str | None, filename: str, media_type: str | None) -> str | None:
    """Presigned inline GET URL for a bucket-backed photo, or None when the proxy must serve it.

    A missing object answers 404. Any other failure returns None so the proxy path still gets a try.
    """
    import asyncio

    backend, key = _photo_backend_and_key(file_path)
    if backend is None or key is None:
        return None
    try:
        await asyncio.wait_for(backend.size(key), timeout=_IMPORTED_S3_TIMEOUT_S)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage") from None
    except Exception as exc:  # noqa: BLE001
        logger.warning("photo presign head failed, using proxy: %s", type(exc).__name__)
        return None
    mt = media_type or mimetypes.guess_type(filename or "")[0] or "application/octet-stream"
    return backend.url_for(
        key,
        expires_in=PRESIGN_TTL_S,
        response_content_type=mt,
        response_content_disposition=_content_disposition(filename or "photo", False),
    )


async def photo_thumb_presigned_url(photo_id: uuid.UUID | str, file_path: str | None) -> str | None:
    """Presigned URL of the photo's thumbnail in the bucket, made and stored there on first use.

    None when the photo is not bucket-backed or the thumbnail cannot be made (the caller then
    presigns the full photo, or proxies).
    """
    import asyncio
    import tempfile
    from pathlib import Path

    backend, key = _photo_backend_and_key(file_path)
    if backend is None or key is None:
        return None
    thumb_key = f"{_THUMB_KEY_DIR}/{photo_id}.jpg"
    try:
        if not await asyncio.wait_for(backend.exists(thumb_key), timeout=_IMPORTED_S3_TIMEOUT_S):
            if await asyncio.wait_for(backend.size(key), timeout=_IMPORTED_S3_TIMEOUT_S) > _THUMB_SOURCE_MAX_BYTES:
                return None
            from app.modules.documents.service import _generate_photo_thumbnail

            source = await asyncio.wait_for(backend.get(key), timeout=60.0)

            def _make() -> bytes | None:
                with tempfile.TemporaryDirectory() as tmp:
                    dest = Path(tmp) / "t.jpg"
                    return dest.read_bytes() if _generate_photo_thumbnail(source, dest) else None

            data = await asyncio.to_thread(_make)
            if data is None:
                return None
            await asyncio.wait_for(backend.put(thumb_key, data, content_type="image/jpeg"), timeout=60.0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("photo thumbnail in bucket failed: %s", type(exc).__name__)
        return None
    return backend.url_for(thumb_key, expires_in=PRESIGN_TTL_S, response_content_type="image/jpeg")
