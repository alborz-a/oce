# [RSC-IRAN] Test suite for per-project role capabilities (steps 3.2-3.5)
"""Unit and contract tests for the per-project role capabilities engine."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.project_roles import (
    CAPS,
    LEGACY,
    get_project_caps,
    get_project_role,
    require_project_cap,
)

# 9 canonical capability keys
ALL_CAPS = [
    "project.read",
    "project.update",
    "members.manage",
    "task.manage",
    "task.work",
    "file.upload",
    "file.modify",
    "chat.read",
    "chat.write",
]

# Access design table truth matrix: role -> allowed capabilities
EXPECTED_TABLE: dict[str, set[str]] = {
    "project_manager": {
        "project.read",
        "project.update",
        "members.manage",
        "task.manage",
        "task.work",
        "file.upload",
        "file.modify",
        "chat.read",
        "chat.write",
    },
    "member": {
        "project.read",
        "task.work",
        "file.upload",
        "chat.read",
        "chat.write",
    },
    "viewer": {
        "project.read",
        "chat.read",
    },
}

MATRIX_PARAMS = [
    (role, cap, cap in EXPECTED_TABLE[role])
    for role in ["project_manager", "member", "viewer"]
    for cap in ALL_CAPS
]


def _user(role="editor", meta=None, uid=None):
    return SimpleNamespace(
        id=uid or uuid.uuid4(),
        role=role,
        metadata_=meta or {},
    )


def _project(owner_id=None, pid=None):
    return SimpleNamespace(
        id=pid or uuid.uuid4(),
        owner_id=owner_id or uuid.uuid4(),
    )


@pytest.mark.parametrize("role,cap,expected", MATRIX_PARAMS)
def test_access_design_table_matrix(role: str, cap: str, expected: bool):
    """Verify every cell of the access design table (3 roles x 9 capabilities)."""
    assert (cap in CAPS[role]) is expected


@pytest.mark.asyncio
async def test_global_admin_gets_project_manager_and_all_caps():
    """Global admin has every capability on every project."""
    session = AsyncMock()
    user = _user(role="admin")
    proj = _project()

    role = await get_project_role(session, user, proj.id)
    assert role == "project_manager"

    caps = await get_project_caps(session, user, proj.id)
    assert caps == CAPS["project_manager"]
    for cap in ALL_CAPS:
        assert cap in caps


@pytest.mark.asyncio
async def test_project_owner_gets_project_manager_and_all_caps():
    """Project owner has project_manager role even without team membership."""
    owner_id = uuid.uuid4()
    proj = _project(owner_id=owner_id)

    session = AsyncMock()
    session.get.side_effect = lambda model, ident: proj if ident == proj.id else None

    user = _user(role="editor", uid=owner_id)
    role = await get_project_role(session, user, proj.id)
    assert role == "project_manager"

    caps = await get_project_caps(session, user, proj.id)
    assert caps == CAPS["project_manager"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "legacy_role,expected_mapped",
    [
        ("lead", "project_manager"),
        ("owner", "project_manager"),
        ("estimator", "member"),
    ],
)
async def test_legacy_role_mappings(legacy_role: str, expected_mapped: str):
    """Legacy team membership roles map to modern roles."""
    assert LEGACY[legacy_role] == expected_mapped

    proj = _project()
    user = _user(role="editor")

    session = AsyncMock()
    session.get.side_effect = lambda model, ident: proj if ident == proj.id else None

    # Mock TeamMembership query result
    exec_mock = MagicMock()
    exec_mock.scalar_one_or_none.return_value = legacy_role
    session.execute.return_value = exec_mock

    role = await get_project_role(session, user, proj.id)
    assert role == expected_mapped


@pytest.mark.asyncio
async def test_all_projects_view_and_manage():
    """User metadata all_projects='view' gives viewer; 'manage' gives project_manager."""
    proj = _project()
    session = AsyncMock()
    session.get.side_effect = lambda model, ident: proj if ident == proj.id else None

    # No membership row
    exec_mock = MagicMock()
    exec_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = exec_mock

    # all_projects: "view" -> viewer
    user_view = _user(role="editor", meta={"all_projects": "view"})
    role_view = await get_project_role(session, user_view, proj.id)
    assert role_view == "viewer"
    caps_view = await get_project_caps(session, user_view, proj.id)
    assert caps_view == CAPS["viewer"]

    # all_projects: "manage" -> project_manager
    user_manage = _user(role="editor", meta={"all_projects": "manage"})
    role_manage = await get_project_role(session, user_manage, proj.id)
    assert role_manage == "project_manager"
    caps_manage = await get_project_caps(session, user_manage, proj.id)
    assert caps_manage == CAPS["project_manager"]

    # Higher existing membership wins over all_projects="view"
    exec_mock.scalar_one_or_none.return_value = "member"
    role_higher = await get_project_role(session, user_view, proj.id)
    assert role_higher == "member"


@pytest.mark.asyncio
async def test_non_member_returns_none_and_empty_caps():
    """Non-member with no metadata flag returns None role and empty caps."""
    proj = _project()
    session = AsyncMock()
    session.get.side_effect = lambda model, ident: proj if ident == proj.id else None

    exec_mock = MagicMock()
    exec_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = exec_mock

    user = _user(role="editor", meta={})
    role = await get_project_role(session, user, proj.id)
    assert role is None

    caps = await get_project_caps(session, user, proj.id)
    assert caps == frozenset()


@pytest.mark.asyncio
async def test_unknown_role_string_counts_as_viewer():
    """Unknown membership role strings fallback to viewer."""
    proj = _project()
    session = AsyncMock()
    session.get.side_effect = lambda model, ident: proj if ident == proj.id else None

    exec_mock = MagicMock()
    exec_mock.scalar_one_or_none.return_value = "custom_contractor_role"
    session.execute.return_value = exec_mock

    user = _user(role="editor")
    role = await get_project_role(session, user, proj.id)
    assert role == "viewer"

    caps = await get_project_caps(session, user, proj.id)
    assert caps == CAPS["viewer"]


@pytest.mark.asyncio
async def test_require_project_cap_dependency():
    """FastAPI dependency raises 404 on missing/non-member and 403 on missing cap."""
    pid = uuid.uuid4()
    proj = _project(pid=pid)

    session = AsyncMock()
    session.get.side_effect = lambda model, ident: proj if ident == pid else None

    request = MagicMock()
    request.path_params = {"project_id": str(pid)}
    request.query_params = {}

    # 1. Non-member -> 404
    exec_mock = MagicMock()
    exec_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = exec_mock

    user_id = str(uuid.uuid4())
    payload = {"sub": user_id, "role": "editor"}

    dep = require_project_cap("file.upload")
    with pytest.raises(HTTPException) as exc_info_404:
        await dep(request, session=session, user_id=user_id, payload=payload)
    assert exc_info_404.value.status_code == 404
    assert exc_info_404.value.detail == "Project not found"

    # 2. Viewer trying file.upload -> 403 project_capability_required:file.upload
    exec_mock.scalar_one_or_none.return_value = "viewer"
    with pytest.raises(HTTPException) as exc_info_403:
        await dep(request, session=session, user_id=user_id, payload=payload)
    assert exc_info_403.value.status_code == 403
    assert exc_info_403.value.detail == "project_capability_required:file.upload"

    # 3. Member on file.upload -> allowed (no exception)
    exec_mock.scalar_one_or_none.return_value = "member"
    await dep(request, session=session, user_id=user_id, payload=payload)

    # 4. Admin bypass -> allowed unconditionally
    admin_payload = {"sub": user_id, "role": "admin"}
    await dep(request, session=session, user_id=user_id, payload=admin_payload)


def test_photo_categories_whitelist_and_legacy_site():
    """Step 6.4: Only nine categories allowed; legacy 'site' normalizes to 'site_progress'."""
    from app.modules.documents.schemas import PHOTO_CATEGORIES, PhotoUpdate
    from pydantic import ValidationError

    expected_categories = (
        "site_progress",
        "before_work",
        "after_work",
        "defect",
        "materials",
        "safety",
        "drawing_doc",
        "site_visit",
        "other",
    )
    assert PHOTO_CATEGORIES == expected_categories

    # legacy "site" maps to "site_progress"
    u = PhotoUpdate(category="site")
    assert u.category == "site_progress"

    # all valid 9 categories pass
    for cat in expected_categories:
        u_valid = PhotoUpdate(category=cat)
        assert u_valid.category == cat

    # invalid category rejected with ValidationError
    with pytest.raises(ValidationError):
        PhotoUpdate(category="invalid_category_xyz")


def test_hidden_users_qa_accounts_and_importer():
    """Step 2.4: QA accounts and importer are hidden from non-admin staff."""
    from app.core.hidden_users import (
        HIDDEN_SYSTEM_EMAILS,
        HIDDEN_SYSTEM_NAMES,
        is_hidden_system_user,
        viewer_is_admin,
    )

    qa_emails = [
        "qa.manager@royalstars.co",
        "qa.member@royalstars.co",
        "qa.guest@royalstars.co",
        "qa.allview@royalstars.co",
    ]
    for email in qa_emails:
        assert email in HIDDEN_SYSTEM_EMAILS
        assert is_hidden_system_user(email, "Some Name")

    for name in ["qa.manager", "qa.member", "qa.guest", "qa.allview"]:
        assert name in HIDDEN_SYSTEM_NAMES
        assert is_hidden_system_user("someone@example.com", name)

    # Prefix match
    assert is_hidden_system_user("qa.custom@test.com", "Custom QA")
    assert is_hidden_system_user("other@test.com", "qa.custom_user")

    # Regular users not hidden
    assert not is_hidden_system_user("staff@royalstars.co", "Ali Reza")

    # viewer_is_admin check
    assert viewer_is_admin({"role": "admin"})
    assert not viewer_is_admin({"role": "editor"})
    assert not viewer_is_admin({"role": "viewer"})


# ── API Tests per 4.4 row for member, viewer, and non-member (Step 4.7) ─────


@pytest.fixture
def api_test_setup():
    from fastapi import FastAPI, Query, Depends
    from app.dependencies import get_current_user_id, get_current_user_payload, get_session
    from app.core.project_roles import require_project_cap
    from app.modules.projects.models import Project
    from app.modules.tasks.models import Task
    from app.modules.documents.models import ProjectPhoto
    from app.modules.team_chat.models import ChatRoom

    app = FastAPI()
    pid = uuid.uuid4()
    tid = uuid.uuid4()
    phid = uuid.uuid4()
    rid = uuid.uuid4()
    uid = uuid.uuid4()

    # Route definitions for all 9 capabilities per 4.4
    @app.patch("/api/v1/projects/{project_id}", dependencies=[Depends(require_project_cap("project.update"))])
    async def r_project_update(project_id: str): return {"cap": "project.update"}

    @app.post("/api/v1/projects/{project_id}/members", dependencies=[Depends(require_project_cap("members.manage"))])
    async def r_members_manage(project_id: str): return {"cap": "members.manage"}

    @app.post("/api/v1/tasks/", dependencies=[Depends(require_project_cap("task.manage"))])
    async def r_task_manage(project_id: str = Query(...)): return {"cap": "task.manage"}

    @app.post("/api/v1/tasks/{task_id}/complete/", dependencies=[Depends(require_project_cap("task.work"))])
    async def r_task_work(task_id: str): return {"cap": "task.work"}

    @app.post("/api/v1/documents/photos/upload/", dependencies=[Depends(require_project_cap("file.upload"))])
    async def r_file_upload(project_id: str = Query(...)): return {"cap": "file.upload"}

    @app.patch("/api/v1/documents/photos/{photo_id}", dependencies=[Depends(require_project_cap("file.modify"))])
    async def r_file_modify(photo_id: str): return {"cap": "file.modify"}

    @app.post("/api/v1/team-chat/rooms/{room_id}/messages/", dependencies=[Depends(require_project_cap("chat.write"))])
    async def r_chat_write(room_id: str): return {"cap": "chat.write"}

    @app.get("/api/v1/projects/{project_id}", dependencies=[Depends(require_project_cap("project.read"))])
    async def r_project_read(project_id: str): return {"cap": "project.read"}

    @app.get("/api/v1/team-chat/project/{project_id}/", dependencies=[Depends(require_project_cap("chat.read"))])
    async def r_chat_read(project_id: str): return {"cap": "chat.read"}

    mock_session = AsyncMock()
    proj = MagicMock(spec=Project)
    proj.id = pid
    proj.owner_id = uuid.uuid4()  # not owner

    task = MagicMock(spec=Task)
    task.id = tid
    task.project_id = pid

    photo = MagicMock(spec=ProjectPhoto)
    photo.id = phid
    photo.project_id = pid

    room = MagicMock(spec=ChatRoom)
    room.id = rid
    room.project_id = pid

    def mock_get(model, ident):
        if ident == pid: return proj
        if ident == tid: return task
        if ident == phid: return photo
        if ident == rid: return room
        return None

    mock_session.get.side_effect = mock_get
    exec_mock = MagicMock()
    mock_session.execute.return_value = exec_mock

    app.dependency_overrides[get_session] = lambda: mock_session
    app.dependency_overrides[get_current_user_id] = lambda: str(uid)

    routes = {
        "project.update": ("PATCH", f"/api/v1/projects/{pid}"),
        "members.manage": ("POST", f"/api/v1/projects/{pid}/members"),
        "task.manage": ("POST", f"/api/v1/tasks/?project_id={pid}"),
        "task.work": ("POST", f"/api/v1/tasks/{tid}/complete/"),
        "file.upload": ("POST", f"/api/v1/documents/photos/upload/?project_id={pid}"),
        "file.modify": ("PATCH", f"/api/v1/documents/photos/{phid}"),
        "chat.write": ("POST", f"/api/v1/team-chat/rooms/{rid}/messages/"),
        "project.read": ("GET", f"/api/v1/projects/{pid}"),
        "chat.read": ("GET", f"/api/v1/team-chat/project/{pid}/"),
    }

    return app, routes, exec_mock, uid


@pytest.mark.asyncio
@pytest.mark.parametrize("cap", ALL_CAPS)
async def test_api_member_capabilities(api_test_setup, cap: str):
    """Step 4.7: Member gets 200 on allowed capabilities, 403 on disallowed."""
    from httpx import AsyncClient, ASGITransport
    from app.dependencies import get_current_user_payload

    app, routes, exec_mock, uid = api_test_setup
    exec_mock.scalar_one_or_none.return_value = "member"
    app.dependency_overrides[get_current_user_payload] = lambda: {"sub": str(uid), "role": "editor"}

    method, url = routes[cap]
    expected_status = 200 if cap in EXPECTED_TABLE["member"] else 403

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.request(method, url)
        assert resp.status_code == expected_status, f"cap={cap} status={resp.status_code} body={resp.text}"
        if expected_status == 403:
            assert f"project_capability_required:{cap}" in resp.json()["detail"]


@pytest.mark.asyncio
@pytest.mark.parametrize("cap", ALL_CAPS)
async def test_api_viewer_capabilities(api_test_setup, cap: str):
    """Step 4.7: Viewer gets 200 on allowed capabilities, 403 on disallowed."""
    from httpx import AsyncClient, ASGITransport
    from app.dependencies import get_current_user_payload

    app, routes, exec_mock, uid = api_test_setup
    exec_mock.scalar_one_or_none.return_value = "viewer"
    app.dependency_overrides[get_current_user_payload] = lambda: {"sub": str(uid), "role": "editor"}

    method, url = routes[cap]
    expected_status = 200 if cap in EXPECTED_TABLE["viewer"] else 403

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.request(method, url)
        assert resp.status_code == expected_status, f"cap={cap} status={resp.status_code} body={resp.text}"
        if expected_status == 403:
            assert f"project_capability_required:{cap}" in resp.json()["detail"]


@pytest.mark.asyncio
@pytest.mark.parametrize("cap", ALL_CAPS)
async def test_api_non_member_returns_404(api_test_setup, cap: str):
    """Step 4.7: Non-member gets 404 Project not found on every capability route."""
    from httpx import AsyncClient, ASGITransport
    from app.dependencies import get_current_user_payload

    app, routes, exec_mock, uid = api_test_setup
    exec_mock.scalar_one_or_none.return_value = None  # No team membership
    app.dependency_overrides[get_current_user_payload] = lambda: {"sub": str(uid), "role": "editor"}

    method, url = routes[cap]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.request(method, url)
        assert resp.status_code == 404, f"cap={cap} status={resp.status_code} body={resp.text}"
        assert resp.json()["detail"] == "Project not found"
