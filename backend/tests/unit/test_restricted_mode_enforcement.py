import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.core.restricted_mode import enforce_restricted_access, is_path_allowed, is_restricted_user

P = "/api/v1/"
ID = str(uuid.uuid4())


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", P + "users/me/"),
        ("GET", P + "users/me"),
        ("POST", P + "users/me/avatar/"),
        ("POST", P + "users/auth/login/"),
        ("GET", P + "projects/"),
        ("GET", P + f"projects/{ID}"),
        ("GET", P + "tasks/"),
        ("GET", P + "tasks/my-tasks/"),
        ("PATCH", P + f"tasks/{ID}"),
        ("POST", P + f"tasks/{ID}/complete/"),
        ("POST", P + "collaboration/comments/"),
        ("GET", P + "documents/"),
        ("GET", P + f"documents/{ID}"),
        ("GET", P + "documents/photos/"),
        ("POST", P + "documents/photos/upload/"),
        ("PATCH", P + f"documents/photos/{ID}"),
        ("GET", P + "notifications/unread-count/"),
    ],
)
def test_allowed(method, path):
    enforce_restricted_access(method, path)


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", P + "finance/claims/"),
        ("GET", P + "boq/boqs/"),
        ("GET", P + "costs/"),
        ("POST", P + "ai/chat/"),
        ("GET", P + "contracts/contracts/"),
        ("GET", P + "bim_hub/models/"),
        ("GET", P + "modules/oe_x/enable"),
        ("POST", P + "modules/"),
        ("GET", P + "branding/"),
        ("GET", P + "users/"),
        ("POST", P + "users/"),
        ("GET", P + f"users/{ID}"),
        ("GET", P + "tasks/export/"),
        ("POST", P + "tasks/import/file/"),
        ("POST", P + "projects/"),
        ("DELETE", P + f"projects/{ID}"),
        ("GET", "/api/other"),
    ],
)
def test_denied_by_default(method, path):
    assert not is_path_allowed(method, path)
    with pytest.raises(HTTPException) as e:
        enforce_restricted_access(method, path)
    assert e.value.status_code == 403


def _u(role="editor", meta=None):
    return SimpleNamespace(role=role, metadata_=meta)


def test_admin_never_restricted(monkeypatch):
    monkeypatch.setenv("OCE_RESTRICTED_PROJECT_MODE_ALL", "1")
    assert not is_restricted_user(_u(role="admin", meta={"restricted_project_mode": True}))


def test_non_restricted_unchanged(monkeypatch):
    monkeypatch.delenv("OCE_RESTRICTED_PROJECT_MODE_ALL", raising=False)
    assert is_restricted_user(_u())  # deny by default
    assert is_restricted_user(_u(role="manager"))  # [RSC-IRAN] managers restricted too
    assert not is_restricted_user(_u(meta={"restricted_project_mode": False}))
    assert is_restricted_user(_u(meta={"restricted_project_mode": True}))


@pytest.mark.asyncio
async def test_non_member_task_access_denied():
    from app.dependencies import verify_project_access

    project = SimpleNamespace(owner_id=uuid.uuid4())
    user = SimpleNamespace(role="editor")
    with (
        patch("app.modules.projects.repository.ProjectRepository.get_by_id", AsyncMock(return_value=project)),
        patch("app.modules.users.repository.UserRepository.get_by_id", AsyncMock(return_value=user)),
        patch("app.modules.teams.access.is_project_member", AsyncMock(return_value=False)),
    ):
        with pytest.raises(HTTPException) as e:
            await verify_project_access(uuid.uuid4(), str(uuid.uuid4()), AsyncMock())
    assert e.value.status_code == 404


def test_photo_file_and_document_download_check_membership():
    import inspect

    from app.modules.documents import router as r

    for name in ("serve_photo_file",):
        assert "verify_project_access" in inspect.getsource(getattr(r, name))
    src = inspect.getsource(r)
    i = src.index('"/{document_id}/download')
    assert "verify_project_access" in src[i : i + 2500]


def test_restricted_staff_can_read_dashboard_cards():
    assert is_path_allowed("GET", P + "projects/dashboard/cards/")
    assert is_path_allowed("GET", P + "projects/dashboard/cards")
    enforce_restricted_access("GET", P + "projects/dashboard/cards/")  # no raise
    # Still blocked: writes on the cards path and project-level writes outside the allowlist.
    assert not is_path_allowed("POST", P + "projects/dashboard/cards/")
    assert not is_path_allowed("DELETE", P + "projects/dashboard/cards/")
    assert not is_path_allowed("POST", P + "projects/")
    assert not is_path_allowed("DELETE", P + f"projects/{ID}")


def test_dashboard_cards_handler_limits_non_admin_to_own_projects():
    import inspect

    from app.modules.projects import router as projects_router

    src = inspect.getsource(projects_router.dashboard_cards)
    # Non-admin branch: owner or member projects only, never the whole table.
    assert "Project.owner_id == uid" in src
    assert "member_project_ids_subquery(uid)" in src
    assert src.index("if is_admin") < src.index("member_project_ids_subquery(uid)")
