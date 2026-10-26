"""Copy documents and photos that live on the local disk into the S3 backend.

Usage (inside the app container, with STORAGE_BACKEND=s3 and S3_KEY_PREFIX set):

    python -m app.modules.documents.migrate_local_to_s3 [--dry-run] [--project-id UUID]

For every distinct local ``file_path`` the file is streamed to ``projects/<project>/<category>/<basename>``
(the backend prepends ``S3_KEY_PREFIX``), the object size is verified, and every row that shared the old
path (a photo and its cross-linked document) is switched to ``s3:<key>``. Local files are NEVER deleted:
their paths are printed as delete candidates for the owner. Re-running is safe: finished rows no longer
have a local path, and an object already present with the right size is not uploaded again.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import sys
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.modules.documents import object_store
from app.modules.documents.models import Document, ProjectPhoto

logger = logging.getLogger(__name__)


def _resolve_local(file_path: str, bases: list[Path]) -> Path | None:
    p = Path(file_path)
    candidates = [p] if p.is_absolute() else [b / p for b in bases]
    for c in candidates:
        if c.is_file():
            return c
    return None


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


async def migrate(
    session: Any,
    backend: Any,
    *,
    project_id: uuid.UUID | None = None,
    dry_run: bool = False,
    bases: list[Path] | None = None,
) -> dict[str, Any]:
    """Migrate local rows. ``backend`` needs ``exists``, ``size`` and ``put_stream`` (the storage backend API)."""
    bases = bases or []
    photo_q = select(ProjectPhoto)
    doc_q = select(Document)
    if project_id is not None:
        photo_q = photo_q.where(ProjectPhoto.project_id == project_id)
        doc_q = doc_q.where(Document.project_id == project_id)
    photos = list((await session.execute(photo_q)).scalars())
    docs = list((await session.execute(doc_q)).scalars())

    # old path -> (project_id, category segment, rows)
    groups: dict[str, dict[str, Any]] = {}
    for ph in photos:
        if ph.file_path and not object_store.is_object_path(ph.file_path):
            g = groups.setdefault(ph.file_path, {"project": ph.project_id, "category": "photos", "rows": []})
            g["rows"].append(ph)
    for d in docs:
        if d.file_path and not object_store.is_object_path(d.file_path):
            g = groups.setdefault(d.file_path, {"project": d.project_id, "category": d.category or "other", "rows": []})
            g["rows"].append(d)

    summary: dict[str, Any] = {"migrated": 0, "skipped_missing": 0, "already_in_s3": 0, "errors": 0,
                               "delete_candidates": [], "dry_run": dry_run}
    for old_path, g in groups.items():
        local = _resolve_local(old_path, bases)
        if local is None:
            summary["skipped_missing"] += 1
            logger.warning("local file missing, row left unchanged: %s", old_path)
            continue
        key = object_store.build_key(g["project"], g["category"], local.name)
        if dry_run:
            summary["migrated"] += 1
            print(f"would copy {local} -> {key}")
            continue
        try:
            want = local.stat().st_size
            present = await backend.exists(key)
            if present and await backend.size(key) == want:
                summary["already_in_s3"] += 1
            else:
                await backend.put_stream(key, local)
                if await backend.size(key) != want:
                    raise RuntimeError(f"size mismatch after upload for {key}")
            new_path = object_store.S3_PATH_PREFIX + key
            for row in g["rows"]:
                row.file_path = new_path
                if isinstance(row, Document):
                    meta = dict(row.metadata_ or {})
                    meta["sha256"] = _sha256(local)
                    row.metadata_ = meta
            await session.flush()
            summary["migrated"] += 1
            summary["delete_candidates"].append(str(local))
        except Exception:  # noqa: BLE001 - one bad file must not stop the run
            summary["errors"] += 1
            logger.exception("migration failed for %s", old_path)
    return summary


async def _main(args: argparse.Namespace) -> int:
    from app.core.storage import get_storage_backend
    from app.database import async_session_factory
    from app.modules.documents.service import PHOTO_BASE, UPLOAD_BASE

    if not object_store.s3_enabled():
        print("STORAGE_BACKEND is not s3: nothing to do", file=sys.stderr)
        return 2
    backend = get_storage_backend()
    async with async_session_factory() as session:
        summary = await migrate(
            session,
            backend,
            project_id=uuid.UUID(args.project_id) if args.project_id else None,
            dry_run=args.dry_run,
            bases=[UPLOAD_BASE, PHOTO_BASE],
        )
        if not args.dry_run:
            await session.commit()
    for p in summary.pop("delete_candidates"):
        print(f"DELETE-CANDIDATE {p}")
    print({k: v for k, v in summary.items()})
    return 1 if summary["errors"] else 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--project-id", default=None)
    return asyncio.run(_main(ap.parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
