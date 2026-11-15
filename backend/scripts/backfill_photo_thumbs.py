"""Pre-build the panel thumbnails of bucket-backed photos, so the first view is not slow.

    python -m scripts.backfill_photo_thumbs --dry-run
    python -m scripts.backfill_photo_thumbs --limit 100
    python -m scripts.backfill_photo_thumbs

Each photo goes through the same ``photo_thumb_presigned_url`` call the panel uses. That call builds
and stores the thumbnail when it is missing and does nothing when it is already there, so the script
can be re-run safely. Up to 4 photos are worked on at once.

Only counts are printed. The presigned URLs are credentials and are never logged.

Exit codes:

    0  every photo was handled (a photo with no thumbnail possible is still handled)
    1  at least one photo raised an error
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.modules.documents.object_store import (  # noqa: E402 - after the sys.path bootstrap above
    _photo_backend_and_key,
    photo_thumb_presigned_url,
)

CONCURRENCY = 4


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="backfill_photo_thumbs",
        description="Pre-build panel thumbnails for bucket-backed photos.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Handle at most N bucket-backed photos.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count the bucket-backed photos and build nothing.",
    )
    return parser.parse_args(argv)


async def _run(limit: int | None, dry_run: bool) -> int:
    from sqlalchemy import select  # noqa: PLC0415

    from app.database import async_session_factory  # noqa: PLC0415
    from app.modules.documents.models import ProjectPhoto  # noqa: PLC0415

    async with async_session_factory() as session:
        rows = (await session.execute(select(ProjectPhoto.id, ProjectPhoto.file_path))).all()

    targets = [
        (photo_id, file_path) for photo_id, file_path in rows if _photo_backend_and_key(file_path)[0] is not None
    ]
    if limit is not None:
        targets = targets[:limit]
    print(f"bucket-backed photos: {len(targets)} of {len(rows)}")
    if dry_run:
        return 0

    gate = asyncio.Semaphore(CONCURRENCY)
    counts = {"ready": 0, "unavailable": 0, "failed": 0}

    async def _one(photo_id, file_path) -> None:
        async with gate:
            try:
                url = await photo_thumb_presigned_url(photo_id, file_path)
            except Exception as exc:  # noqa: BLE001
                counts["failed"] += 1
                print(f"photo {photo_id} failed: {type(exc).__name__}")
                return
            counts["ready" if url else "unavailable"] += 1

    await asyncio.gather(*(_one(photo_id, file_path) for photo_id, file_path in targets))
    print(
        f"thumbnails ready: {counts['ready']}, unavailable: {counts['unavailable']}, failed: {counts['failed']}"
    )
    return 1 if counts["failed"] else 0


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    return asyncio.run(_run(args.limit, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
