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
        ("POST", P + "tasks/"),
        ("DELETE", P + f"tasks/{ID}"),
        ("POST", P + "tasks/import/file/"),
        ("DELETE", P + f"documents/photos/{ID}"),
        ("DELETE", P + f"documents/{ID}"),
        ("POST", P + "projects/"),
        ("DELETE", P + f"projects/{ID}"),
        ("PATCH", P + f"projects/{ID}"),
        ("GET", P + "projects/dashboard/cards/"),
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
    assert not is_restricted_user(_u())
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
