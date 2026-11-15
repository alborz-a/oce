# DDC-CWICR-OE: DataDrivenConstruction / OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Admin-only redaction for the file-manager responses (RSD-0.46, B1/B2).

Only the system admin (backend role ``admin``) may see file sizes, storage
roots or on-disk paths. Every other caller gets the same rows with those
fields blanked, so the UI cannot show them and the API JSON does not carry
them either.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.file_manager_schemas import (
    EmailLinkResponse,
    ExportPreview,
    FileRow,
    FileTreeNode,
    StorageLocations,
)

# Keys in ``FileRow.extra`` that carry a server-side storage path.
_PATH_EXTRA_KEYS = frozenset({"thumbnail_path", "storage_path", "file_path", "physical_path"})


async def viewer_is_system_admin(session: AsyncSession, user_id: str | None) -> bool:
    """True when *user_id* holds the backend role ``admin``.

    Same DB-backed check as ``verify_project_access`` (admin bypass), so a
    stale token cannot keep the privilege after the role is removed.
    """
    if not user_id:
        return False
    from app.modules.users.repository import UserRepository

    try:
        user = await UserRepository(session).get_by_id(uuid.UUID(str(user_id)))
    except (ValueError, TypeError):
        return False
    return getattr(user, "role", "") == "admin"


def redact_file_rows(rows: Iterable[FileRow]) -> list[FileRow]:
    """Blank size, on-disk paths and path-bearing extras for a non-admin."""
    out: list[FileRow] = []
    for row in rows:
        extra = {k: v for k, v in row.extra.items() if k not in _PATH_EXTRA_KEYS}
        out.append(
            row.model_copy(
                update={
                    "size_bytes": 0,
                    "physical_path": "",
                    "storage_backend": None,
                    "relative_path": "",
                    "extra": extra,
                }
            )
        )
    return out


def redact_tree(nodes: Iterable[FileTreeNode]) -> list[FileTreeNode]:
    """Blank byte totals and physical paths in the category tree, recursively."""
    out: list[FileTreeNode] = []
    for node in nodes:
        out.append(
            node.model_copy(
                update={
                    "total_bytes": 0,
                    "physical_path": None,
                    "storage_backend": None,
                    "children": redact_tree(node.children),
                }
            )
        )
    return out


def redact_locations(loc: StorageLocations) -> StorageLocations:
    """Drop every on-disk root, DB path and override; keep the project identity."""
    return loc.model_copy(
        update={
            "storage_path_override": None,
            "db_path": None,
            "uploads_root": None,
            "photos_root": None,
            "sheets_root": None,
            "bim_root": None,
            "dwg_root": None,
            "extras": {},
            "notes": [],
            "storage_backend": None,
        }
    )


def redact_export_preview(preview: ExportPreview) -> ExportPreview:
    """Blank the bundle size estimate for a non-admin (the export wizard shows it)."""
    return preview.model_copy(update={"estimated_size_bytes": 0})


def redact_email_link(link: EmailLinkResponse) -> EmailLinkResponse:
    """Blank the file size in a minted email link for a non-admin."""
    return link.model_copy(update={"size_bytes": 0})
