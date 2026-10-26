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
