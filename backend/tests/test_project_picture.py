# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Project picture (avatar): response fields, upload validation and manager-only RBAC."""

from __future__ import annotations

import io
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, UploadFile

import app.modules.projects.picture as picture_mod
import app.modules.projects.router as router_mod
from app.modules.projects.schemas import ProjectResponse

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP_BYTES = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 64


def _project_kwargs(**overrides) -> dict:
    now = "2026-11-22T10:00:00"
    base = {
        "id": uuid.uuid4(),
        "name": "Tower A",
        "description": "",
        "region": "",
        "classification_standard": "din276",
        "currency": "EUR",
        "locale": "de",
        "validation_rule_sets": ["boq_quality"],
        "compliance_rule_packs": ["universal"],
        "status": "active",
        "owner_id": uuid.uuid4(),
        "metadata": {},
        "created_at": now,
        "updated_at": now,
    }
    base.update(overrides)
    return base


def _backend_mock(url: str | None) -> MagicMock:
    backend = MagicMock()
    backend.url_for = MagicMock(return_value=url)
    backend.put = AsyncMock()
    backend.delete = AsyncMock()
    return backend


# ── Response fields ─────────────────────────────────────────────────────


def test_response_has_picture_url_when_key_set() -> None:
    backend = _backend_mock("https://s3.example/presigned")
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        resp = ProjectResponse(**_project_kwargs(picture_key="projects/x/picture.png"))
    assert resp.picture_url == "https://s3.example/presigned"
    backend.url_for.assert_called_once()
    assert backend.url_for.call_args.args[0] == "projects/x/picture.png"


def test_response_picture_url_none_without_key() -> None:
    backend = _backend_mock("https://s3.example/presigned")
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        resp = ProjectResponse(**_project_kwargs())
    assert resp.picture_url is None
    backend.url_for.assert_not_called()


def test_response_picture_url_none_on_local_backend() -> None:
    backend = _backend_mock(None)
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        resp = ProjectResponse(**_project_kwargs(picture_key="projects/x/picture.jpg"))
    assert resp.picture_url is None


def test_response_never_serialises_picture_key() -> None:
    backend = _backend_mock("https://s3.example/presigned")
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        resp = ProjectResponse(**_project_kwargs(picture_key="projects/x/picture.png"))
    dumped = resp.model_dump()
    assert "picture_key" not in dumped
    assert dumped["picture_url"] == "https://s3.example/presigned"


def test_response_color_from_mizito_custom_fields() -> None:
    backend = _backend_mock(None)
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        resp = ProjectResponse(**_project_kwargs(custom_fields={"mizito": {"color": "light-blue"}}))
        none_resp = ProjectResponse(**_project_kwargs(custom_fields={"other": 1}))
    assert resp.color == "light-blue"
    assert none_resp.color is None


# ── Upload validation ───────────────────────────────────────────────────


def _upload(data: bytes, filename: str = "pic.png") -> UploadFile:
    return UploadFile(file=io.BytesIO(data), filename=filename)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("data", "ext"),
    [(PNG_BYTES, "png"), (JPEG_BYTES, "jpg"), (WEBP_BYTES, "webp")],
)
async def test_read_validated_picture_accepts_png_jpg_webp(data: bytes, ext: str) -> None:
    content, got_ext, _mime = await picture_mod.read_validated_picture(_upload(data))
    assert content == data
    assert got_ext == ext


@pytest.mark.asyncio
async def test_read_validated_picture_rejects_non_image_by_signature() -> None:
    with pytest.raises(HTTPException) as exc:
        await picture_mod.read_validated_picture(_upload(b"%PDF-1.4 not an image", "pic.png"))
    assert exc.value.status_code == 415


@pytest.mark.asyncio
async def test_read_validated_picture_rejects_over_5mb() -> None:
    too_big = PNG_BYTES + b"\x00" * (picture_mod.MAX_PICTURE_BYTES)
    with pytest.raises(HTTPException) as exc:
        await picture_mod.read_validated_picture(_upload(too_big))
    assert exc.value.status_code == 413


@pytest.mark.asyncio
async def test_store_picture_writes_key_and_drops_previous_extension() -> None:
    project_id = uuid.uuid4()
    backend = _backend_mock(None)
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        key = await picture_mod.store_picture(project_id, _upload(JPEG_BYTES), "projects/x/picture.png")
    assert key == f"projects/{project_id}/picture.jpg"
    backend.put.assert_awaited_once()
    assert backend.put.call_args.args[0] == key
    backend.delete.assert_awaited_once_with("projects/x/picture.png")


# ── RBAC: manager-only upload and delete ────────────────────────────────


def test_picture_routes_carry_project_update_capability() -> None:
    wanted = {("POST", "/{project_id}/picture"), ("DELETE", "/{project_id}/picture")}
    found = set()
    for route in router_mod.router.routes:
        methods = getattr(route, "methods", set()) or set()
        for method in methods:
            if (method, route.path) in wanted:
                found.add((method, route.path))
                # require_project_cap is a closure; its dependency call is the check.
                assert any(dep.dependency is not None for dep in route.dependencies)
    assert found == wanted


@pytest.mark.asyncio
async def test_upload_denied_for_non_manager_never_stores() -> None:
    project_id = uuid.uuid4()
    denied = HTTPException(status_code=403, detail="project_capability_required:project.update")
    store = AsyncMock()
    with (
        patch.object(router_mod, "_verify_project_updater", AsyncMock(side_effect=denied)),
        patch.object(router_mod, "store_picture", store),
    ):
        with pytest.raises(HTTPException) as exc:
            await router_mod.upload_project_picture(
                project_id=project_id,
                user_id="member-user",
                payload={"role": "user"},
                session=AsyncMock(),
                file=_upload(PNG_BYTES),
                service=MagicMock(),
            )
    assert exc.value.status_code == 403
    store.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_denied_for_non_manager_never_removes() -> None:
    project_id = uuid.uuid4()
    denied = HTTPException(status_code=403, detail="project_capability_required:project.update")
    remove = AsyncMock()
    with (
        patch.object(router_mod, "_verify_project_updater", AsyncMock(side_effect=denied)),
        patch.object(router_mod, "remove_picture", remove),
    ):
        with pytest.raises(HTTPException) as exc:
            await router_mod.delete_project_picture(
                project_id=project_id,
                user_id="member-user",
                payload={"role": "user"},
                session=AsyncMock(),
                service=MagicMock(),
            )
    assert exc.value.status_code == 403
    remove.assert_not_awaited()


@pytest.mark.asyncio
async def test_upload_by_manager_sets_key_on_project() -> None:
    project_id = uuid.uuid4()
    project = SimpleNamespace(picture_key=None)
    service = MagicMock()
    service.get_project = AsyncMock(return_value=project)
    session = AsyncMock()
    backend = _backend_mock(None)
    with (
        patch.object(router_mod, "_verify_project_updater", AsyncMock(return_value=project)),
        patch.object(router_mod, "_project_response_with_caps", AsyncMock(return_value="resp")),
        patch.object(picture_mod, "get_storage_backend", return_value=backend),
    ):
        out = await router_mod.upload_project_picture(
            project_id=project_id,
            user_id="manager-user",
            payload={"role": "user"},
            session=session,
            file=_upload(PNG_BYTES),
            service=service,
        )
    assert out == "resp"
    assert project.picture_key == f"projects/{project_id}/picture.png"
    session.flush.assert_awaited()
