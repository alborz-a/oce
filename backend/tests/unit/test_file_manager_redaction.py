# DDC-CWICR-OE: DataDrivenConstruction / OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""RSD-0.46 B1/B2 - file-manager responses strip sizes and storage paths for non-admins.

Pure model-level tests: the redaction helpers take already-built response
models, so no database is needed. The admin lookup itself is covered by the
DB-backed tests in ``tests/modules/test_documents_security.py``.
"""

from __future__ import annotations

import json

from app.modules.projects.file_manager_redact import (
    redact_file_rows,
    redact_locations,
    redact_tree,
)
from app.modules.projects.file_manager_schemas import (
    FileListResponse,
    FileRow,
    FileTreeNode,
    StorageLocations,
)

PROJECT_ID = "11111111-1111-1111-1111-111111111111"
SECRET_ROOT = "/srv/secret-disk/oce/uploads"


def _row(kind: str = "document") -> FileRow:
    return FileRow(
        id="22222222-2222-2222-2222-222222222222",
        kind=kind,  # type: ignore[arg-type]
        name="plan.pdf",
        project_id=PROJECT_ID,
        size_bytes=2_945_678,
        physical_path=f"{SECRET_ROOT}/plan.pdf",
        relative_path="uploads/plan.pdf",
        extra={"thumbnail_path": f"{SECRET_ROOT}/thumbs/x.jpg", "gps_lat": 52.5},
    )


def test_file_rows_lose_size_and_paths_for_non_admin() -> None:
    out = redact_file_rows([_row(), _row("photo")])
    for row in out:
        assert row.size_bytes == 0
        assert row.physical_path == ""
        assert row.relative_path == ""
        assert row.storage_backend is None  # B1: backend name is an admin-only detail
        assert "thumbnail_path" not in row.extra
        assert row.extra.get("gps_lat") == 52.5  # non-path extras survive


def test_uploader_id_survives_redaction_for_edit_button() -> None:
    """E3: the UI reads ``extra.created_by`` to show the uploader's edit button."""
    row = _row("photo")
    row = row.model_copy(update={"extra": {**row.extra, "created_by": "33333333-3333-3333-3333-333333333333"}})
    out = redact_file_rows([row])
    assert out[0].extra.get("created_by") == "33333333-3333-3333-3333-333333333333"


def test_file_list_json_has_no_size_or_path_for_non_admin() -> None:
    listing = FileListResponse(project_id=PROJECT_ID, items=[_row()], total=1, limit=50, offset=0)
    payload = listing.model_copy(update={"items": redact_file_rows(listing.items)}).model_dump_json()
    assert SECRET_ROOT not in payload
    assert "2945678" not in payload
    assert '"storage_backend":"local"' not in payload
    assert '"storage_backend": "local"' not in payload


def test_photo_metadata_storage_keys_removed_for_non_admin() -> None:
    from app.modules.documents.router import _strip_photo_storage_meta

    meta = {
        "storage": "bucket-mount",
        "size_bytes": 123,
        "source_path": "/mnt/rclone/x.jpg",
        "s3_key": "photos/a.jpg",
        "exif_make": "Canon",
        "seed": True,
    }
    assert _strip_photo_storage_meta(meta) == {"exif_make": "Canon", "seed": True}


def test_tree_totals_and_paths_are_blanked_recursively() -> None:
    child = FileTreeNode(
        id="category:document:child",
        label="Child",
        total_bytes=500,
        physical_path=f"{SECRET_ROOT}/child",
    )
    root = FileTreeNode(
        id="category:document",
        label="Documents",
        total_bytes=1_000,
        physical_path=SECRET_ROOT,
        children=[child],
    )
    out = redact_tree([root])
    assert out[0].total_bytes == 0
    assert out[0].physical_path is None
    assert out[0].children[0].total_bytes == 0
    assert out[0].children[0].physical_path is None
    assert out[0].storage_backend is None
    assert out[0].children[0].storage_backend is None
    assert SECRET_ROOT not in json.dumps([n.model_dump() for n in out], default=str)


def test_locations_drop_every_disk_root_for_non_admin() -> None:
    loc = StorageLocations(
        project_id=PROJECT_ID,
        project_name="Tower",
        storage_path_override=SECRET_ROOT,
        db_path="/srv/secret-disk/oce.db",
        uploads_root=SECRET_ROOT,
        photos_root=f"{SECRET_ROOT}/photos",
        extras={"takeoff_root": f"{SECRET_ROOT}/takeoff"},
        notes=["mixed roots"],
        storage_backend="s3",
    )
    out = redact_locations(loc)
    dumped = out.model_dump_json()
    assert SECRET_ROOT not in dumped
    assert "secret-disk" not in dumped
    assert '"s3"' not in dumped
    assert out.project_name == "Tower"  # identity survives
    assert out.extras == {}
    assert out.notes == []
    assert out.storage_backend is None
