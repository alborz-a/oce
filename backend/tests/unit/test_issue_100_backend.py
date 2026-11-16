"""Unit & PG-backed regression tests for Issue #100 Phase 1 backend fixes (1.1 - 1.5)."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.restricted_mode import enforce_restricted_access, is_path_allowed
from app.dependencies import (
    get_current_user_id,
    get_current_user_payload,
    get_session,
)
from app.modules.collaboration import service as collab_service_mod
from app.modules.collaboration.models import Comment
from app.modules.collaboration.permissions import register_collaboration_permissions
from app.modules.collaboration.router import router as collaboration_router
from app.modules.projects.models import Project
from app.modules.tasks import service as tasks_service_mod
from app.modules.tasks.models import Task
from app.modules.tasks.permissions import register_tasks_permissions
from app.modules.tasks.router import router as tasks_router
from app.modules.team_chat.hub import chat_hub
from app.modules.team_chat.models import ChatMessage, ChatRoom
from app.modules.team_chat.permissions import register_team_chat_permissions
from app.modules.team_chat.router import router as team_chat_router
from app.modules.teams.models import Team, TeamMembership
from app.modules.users.models import User
from scripts.backfill_mizito_topic_chat import backfill_topic_chat
from tests._pg import transactional_session


@pytest.fixture(scope="session", autouse=True)
def _register_perms() -> None:
    register_tasks_permissions()
    register_collaboration_permissions()
    register_team_chat_permissions()


@pytest.fixture(autouse=True)
def _isolate_hub_and_events(monkeypatch: pytest.MonkeyPatch) -> None:
    chat_hub.reset()

    async def _noop(*args: object, **kwargs: object) -> None:
        return None

    monkeypatch.setattr(collab_service_mod, "_safe_publish", _noop)
    monkeypatch.setattr(tasks_service_mod, "_safe_publish", _noop)
    monkeypatch.setattr(tasks_service_mod, "_safe_audit", _noop)


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    async with transactional_session() as s:
        yield s


async def _make_user(session: AsyncSession, *, role: str = "editor", name: str = "User") -> User:
    u = User(
        email=f"u-{uuid.uuid4().hex[:10]}@example.com",
        hashed_password="x",
        role=role,
        is_active=True,
        full_name=name,
    )
    session.add(u)
    await session.flush()
    return u


async def _make_project_with_team(session: AsyncSession, owner: User, *, name: str = "P1") -> tuple[Project, Team]:
    project = Project(name=name, owner_id=owner.id, currency="IRR")
    session.add(project)
    await session.flush()
    team = Team(project_id=project.id, name="Default", is_default=True, is_active=True)
    session.add(team)
    await session.flush()
    return project, team


async def _add_member(session: AsyncSession, team: Team, user: User, *, role: str = "member") -> TeamMembership:
    m = TeamMembership(team_id=team.id, user_id=user.id, role=role)
    session.add(m)
    await session.flush()
    return m


def _build_client(db_session: AsyncSession, user: User) -> AsyncClient:
    uid = str(user.id)
    role = user.role
    app = FastAPI()
    app.include_router(tasks_router, prefix="/api/v1/tasks")
    app.include_router(collaboration_router, prefix="/api/v1/collaboration")
    app.include_router(team_chat_router, prefix="/api/v1/team-chat")

    async def _session_override() -> AsyncIterator[AsyncSession]:
        yield db_session

    async def _user_override() -> str:
        return uid

    async def _payload_override() -> dict[str, Any]:
        return {"sub": uid, "role": role, "permissions": []}

    app.dependency_overrides[get_session] = _session_override
    app.dependency_overrides[get_current_user_id] = _user_override
    app.dependency_overrides[get_current_user_payload] = _payload_override
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── 1.1: responsible_id / persons_involved permission fix ────────────────────


@pytest.mark.asyncio
async def test_1_1_task_comment_and_complete_use_responsible_and_persons_involved(session: AsyncSession) -> None:
    owner = await _make_user(session, role="admin", name="مدیر")
    responsible = await _make_user(session, role="editor", name="مسئول")
    involved = await _make_user(session, role="editor", name="درگیر")
    unassigned = await _make_user(session, role="editor", name="عضو دیگر")
    viewer = await _make_user(session, role="viewer", name="مهمان")

    project, team = await _make_project_with_team(session, owner)
    await _add_member(session, team, responsible, role="member")
    await _add_member(session, team, involved, role="member")
    await _add_member(session, team, unassigned, role="member")
    await _add_member(session, team, viewer, role="viewer")

    task_a = Task(
        project_id=project.id,
        task_type="task",
        title="Task A",
        status="open",
        responsible_id=str(responsible.id),
        persons_involved=[str(involved.id)],
    )
    task_b = Task(
        project_id=project.id,
        task_type="task",
        title="Task B",
        status="open",
        responsible_id=str(responsible.id),
        persons_involved=[],
    )
    task_viewer = Task(
        project_id=project.id,
        task_type="task",
        title="Task Viewer",
        status="open",
        responsible_id=str(viewer.id),
    )
    session.add_all([task_a, task_b, task_viewer])
    await session.flush()

    # Unassigned member is rejected (403) for both commenting and completing.
    async with _build_client(session, unassigned) as client:
        r_comment = await client.post(
            "/api/v1/collaboration/comments/",
            json={"entity_type": "task", "entity_id": str(task_a.id), "text": "nope"},
        )
        assert r_comment.status_code == 403

        r_complete = await client.post(f"/api/v1/tasks/{task_a.id}/complete/")
        assert r_complete.status_code == 403

    # Viewer lacks task.work even if set as responsible_id.
    async with _build_client(session, viewer) as client:
        r_v_complete = await client.post(f"/api/v1/tasks/{task_viewer.id}/complete/")
        assert r_v_complete.status_code in (403,)

    # responsible_id can comment and complete.
    async with _build_client(session, responsible) as client:
        r_comment = await client.post(
            "/api/v1/collaboration/comments/",
            json={"entity_type": "task", "entity_id": str(task_a.id), "text": "گزارش مسئول"},
        )
        assert r_comment.status_code == 201, r_comment.text

        r_complete = await client.post(f"/api/v1/tasks/{task_b.id}/complete/", json={"result": "تمام"})
        assert r_complete.status_code == 200, r_complete.text
        assert r_complete.json()["status"] == "completed"

    # persons_involved member can comment and complete.
    async with _build_client(session, involved) as client:
        r_comment = await client.post(
            "/api/v1/collaboration/comments/",
            json={"entity_type": "task", "entity_id": str(task_a.id), "text": "گزارش همکار"},
        )
        assert r_comment.status_code == 201, r_comment.text

        r_complete = await client.post(f"/api/v1/tasks/{task_a.id}/complete/", json={"result": "تکمیل"})
        assert r_complete.status_code == 200, r_complete.text
        assert r_complete.json()["status"] == "completed"


# ── 1.2: restricted_mode allowlist & comment PATCH/DELETE entity guard ───────


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/v1/meetings/"),
        ("POST", "/api/v1/meetings/"),
        ("PATCH", f"/api/v1/meetings/{uuid.UUID(int=1)}"),
        ("DELETE", f"/api/v1/meetings/{uuid.UUID(int=1)}"),
        ("POST", f"/api/v1/meetings/{uuid.UUID(int=1)}/minutes/generate/"),
        ("GET", f"/api/v1/meetings/{uuid.UUID(int=1)}/minutes/export/pdf/"),
        ("GET", f"/api/v1/timeline/projects/{uuid.UUID(int=1)}"),
        ("GET", f"/api/v1/timeline/projects/{uuid.UUID(int=1)}/"),
        ("GET", "/api/v1/schedule/schedules/"),
        ("GET", f"/api/v1/schedule/schedules/{uuid.UUID(int=1)}/gantt/"),
        ("PATCH", f"/api/v1/collaboration/comments/{uuid.UUID(int=1)}"),
        ("PATCH", f"/api/v1/collaboration/comments/{uuid.UUID(int=1)}/"),
        ("DELETE", f"/api/v1/collaboration/comments/{uuid.UUID(int=1)}"),
        ("DELETE", f"/api/v1/collaboration/comments/{uuid.UUID(int=1)}/"),
    ],
)
def test_1_2_restricted_mode_allows_new_workspace_paths(method: str, path: str) -> None:
    assert is_path_allowed(method, path)
    enforce_restricted_access(method, path)


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", "/api/v1/schedule/schedules/"),
        ("PATCH", f"/api/v1/schedule/schedules/{uuid.UUID(int=1)}"),
        ("DELETE", f"/api/v1/schedule/schedules/{uuid.UUID(int=1)}"),
        ("GET", f"/api/v1/timeline/projects/{uuid.UUID(int=1)}/entities/task/{uuid.UUID(int=2)}"),
        ("GET", "/api/v1/boq/"),
        ("GET", "/api/v1/finance/claims/"),
        ("DELETE", "/api/v1/collaboration/comments/"),
    ],
)
def test_1_2_restricted_mode_still_blocks_unrelated_paths(method: str, path: str) -> None:
    assert not is_path_allowed(method, path)


@pytest.mark.asyncio
async def test_1_2_comment_patch_and_delete_verify_entity_access(session: AsyncSession) -> None:
    owner = await _make_user(session, role="admin")
    author = await _make_user(session, role="editor")
    other_member = await _make_user(session, role="editor")
    project, team = await _make_project_with_team(session, owner)
    membership = await _add_member(session, team, author, role="member")
    await _add_member(session, team, other_member, role="member")

    task = Task(project_id=project.id, task_type="task", title="T", status="open")
    session.add(task)
    await session.flush()

    comment = Comment(entity_type="task", entity_id=str(task.id), author_id=author.id, text="اول")
    session.add(comment)
    await session.flush()

    # Author with project access can PATCH.
    async with _build_client(session, author) as client:
        r_patch = await client.patch(
            f"/api/v1/collaboration/comments/{comment.id}",
            json={"text": "ویرایش‌شده"},
        )
        assert r_patch.status_code == 200, r_patch.text
        assert r_patch.json()["text"] == "ویرایش‌شده"

    # Non-author project member gets 403.
    async with _build_client(session, other_member) as client:
        r_other = await client.patch(
            f"/api/v1/collaboration/comments/{comment.id}",
            json={"text": "hijack"},
        )
        assert r_other.status_code == 403

    # Remove author from project -> entity access check fails closed with 404 on PATCH & DELETE.
    await session.delete(membership)
    await session.flush()

    async with _build_client(session, author) as client:
        r_patch_removed = await client.patch(
            f"/api/v1/collaboration/comments/{comment.id}",
            json={"text": "after removal"},
        )
        assert r_patch_removed.status_code == 404

        r_delete_removed = await client.delete(f"/api/v1/collaboration/comments/{comment.id}")
        assert r_delete_removed.status_code == 404

    # Re-add author -> DELETE succeeds.
    await _add_member(session, team, author, role="member")
    async with _build_client(session, author) as client:
        r_del = await client.delete(f"/api/v1/collaboration/comments/{comment.id}")
        assert r_del.status_code == 204


# ── 1.3: tasks limit=500 + collaboration/comments/?entity_type=task&project_id ──


@pytest.mark.asyncio
async def test_1_3_tasks_limit_500_and_comments_project_id_filter(session: AsyncSession) -> None:
    owner = await _make_user(session, role="admin", name="مدیر پروژه")
    member = await _make_user(session, role="editor", name="مهندس ناظر")
    outsider = await _make_user(session, role="editor", name="غریبه")

    p1, t1 = await _make_project_with_team(session, owner, name="Project 1")
    p2, _t2 = await _make_project_with_team(session, owner, name="Project 2")
    await _add_member(session, t1, member, role="member")

    # Create 120 tasks in p1 to verify >100 items come back in a single request with limit=500.
    p1_tasks = [
        Task(project_id=p1.id, task_type="task", title=f"Task {i}", status="open", responsible_id=str(member.id))
        for i in range(120)
    ]
    private_task = Task(
        project_id=p1.id,
        task_type="task",
        title="Secret task",
        status="open",
        is_private=True,
        created_by=str(owner.id),
    )
    p2_task = Task(project_id=p2.id, task_type="task", title="Other project task", status="open")
    session.add_all([*p1_tasks, private_task, p2_task])
    await session.flush()

    now = datetime.now(UTC)
    c1 = Comment(
        entity_type="task",
        entity_id=str(p1_tasks[0].id),
        author_id=member.id,
        text="کامنت ۱",
        created_at=now - timedelta(minutes=10),
    )
    c2 = Comment(
        entity_type="task",
        entity_id=str(p1_tasks[1].id),
        author_id=owner.id,
        text="کامنت ۲",
        created_at=now - timedelta(minutes=5),
    )
    c_priv = Comment(
        entity_type="task",
        entity_id=str(private_task.id),
        author_id=owner.id,
        text="کامنت خصوصی",
        created_at=now - timedelta(minutes=3),
    )
    c_other = Comment(
        entity_type="task",
        entity_id=str(p2_task.id),
        author_id=owner.id,
        text="پروژه دیگر",
        created_at=now - timedelta(minutes=1),
    )
    session.add_all([c1, c2, c_priv, c_other])
    await session.flush()

    c1_reply = Comment(
        entity_type="task",
        entity_id=str(p1_tasks[0].id),
        author_id=owner.id,
        text="پاسخ ۱",
        parent_comment_id=c1.id,
        created_at=now - timedelta(minutes=8),
    )
    session.add(c1_reply)
    await session.flush()

    async with _build_client(session, member) as client:
        r_tasks = await client.get(f"/api/v1/tasks/?project_id={p1.id}&limit=500")
        assert r_tasks.status_code == 200, r_tasks.text
        assert len(r_tasks.json()["items"]) == 120

        r_my = await client.get("/api/v1/tasks/my-tasks/?limit=500")
        assert r_my.status_code == 200, r_my.text
        assert len(r_my.json()["items"]) == 120

        r_over = await client.get(f"/api/v1/tasks/?project_id={p1.id}&limit=501")
        assert r_over.status_code == 422

        # Project-wide task comments query returns c1 (with nested reply) and c2,
        # excludes private task comment and p2 comment.
        r_comments = await client.get(
            f"/api/v1/collaboration/comments/?entity_type=task&project_id={p1.id}&limit=500"
        )
        assert r_comments.status_code == 200, r_comments.text
        body = r_comments.json()
        assert body["total"] == 2
        texts = [item["text"] for item in body["items"]]
        assert texts == ["کامنت ۱", "کامنت ۲"]
        assert body["items"][0]["author_name"] == "مهندس ناظر"
        assert [r["text"] for r in body["items"][0]["replies"]] == ["پاسخ ۱"]
        assert body["items"][0]["replies"][0]["author_name"] == "مدیر پروژه"

        # Validation: missing both entity_id and project_id -> 400.
        r_bad1 = await client.get("/api/v1/collaboration/comments/?entity_type=task")
        assert r_bad1.status_code == 400

        # Validation: non-task entity_type with project_id but no entity_id -> 400.
        r_bad2 = await client.get(f"/api/v1/collaboration/comments/?entity_type=rfi&project_id={p1.id}")
        assert r_bad2.status_code == 400

    # Outsider cannot query p1 comments (404).
    async with _build_client(session, outsider) as client:
        r_leak = await client.get(f"/api/v1/collaboration/comments/?entity_type=task&project_id={p1.id}")
        assert r_leak.status_code == 404


# ── 1.4: team_chat reactions endpoint + WS broadcast ─────────────────────────


class _FakeWS:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def send_json(self, data: dict[str, Any]) -> None:
        self.events.append(data)


@pytest.mark.asyncio
async def test_1_4_team_chat_reactions_toggle_and_ws_broadcast(session: AsyncSession) -> None:
    owner = await _make_user(session, role="admin", name="مدیر")
    m1 = await _make_user(session, role="editor", name="عضو ۱")
    m2 = await _make_user(session, role="editor", name="عضو ۲")
    viewer = await _make_user(session, role="viewer", name="مهمان")
    outsider = await _make_user(session, role="editor", name="غریبه")

    project, team = await _make_project_with_team(session, owner)
    await _add_member(session, team, m1, role="member")
    await _add_member(session, team, m2, role="member")
    await _add_member(session, team, viewer, role="viewer")

    room = ChatRoom(kind="project", project_id=project.id, name=project.name, created_by=str(owner.id))
    session.add(room)
    await session.flush()

    msg = ChatMessage(room_id=room.id, author_id=m1.id, text="سلام تیم")
    session.add(msg)
    await session.flush()
    msg_id = msg.id
    room_id = room.id
    m1_id = str(m1.id)
    m2_id = str(m2.id)

    c_m1 = _build_client(session, m1)
    c_m2 = _build_client(session, m2)
    c_viewer = _build_client(session, viewer)
    c_outsider = _build_client(session, outsider)

    ws = _FakeWS()
    await chat_hub.join(ws, m2.id)  # type: ignore[arg-type]
    await chat_hub.subscribe(ws, {room_id})

    # Member 2 checks project room info (unread=1, last_read_at=None), marks read, checks again.
    async with c_m2 as client:
        r_room = await client.get(f"/api/v1/team-chat/rooms/project/{project.id}/")
        assert r_room.status_code == 200, r_room.text
        assert r_room.json()["unread"] == 1
        assert r_room.json()["last_read_at"] is None
        assert (await client.post(f"/api/v1/team-chat/rooms/{room_id}/read/")).status_code == 204
        r_room2 = await client.get(f"/api/v1/team-chat/rooms/project/{project.id}/")
        assert r_room2.status_code == 200
        assert r_room2.json()["unread"] == 0
        assert r_room2.json()["last_read_at"] is not None

    # Member 1 posts a message carrying quoted_entity metadata and adds 👍 reaction.
    async with c_m1 as client:
        r_quoted = await client.post(
            f"/api/v1/team-chat/rooms/{room_id}/messages/",
            json={
                "text": "درباره عکس سقف",
                "metadata": {"quoted_entity": {"kind": "photo", "id": "p1", "title": "بتن ریزی"}},
            },
        )
        assert r_quoted.status_code == 201, r_quoted.text
        assert r_quoted.json()["metadata"]["quoted_entity"]["title"] == "بتن ریزی"

        r1 = await client.post(
            f"/api/v1/team-chat/messages/{msg_id}/reactions/",
            json={"emoji": "👍"},
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["metadata"]["reactions"] == {"👍": [m1_id]}
        assert d1["edited_at"] is None

    # Verify DB persistence via flag_modified by expiring identity map and re-reading.
    session.expire_all()
    persisted = await session.get(ChatMessage, msg_id)
    assert persisted is not None
    assert persisted.metadata_["reactions"] == {"👍": [m1_id]}

    # Member 2 adds 👍 and 🎉
    async with _build_client(session, await session.get(User, uuid.UUID(m2_id))) as client:  # type: ignore[arg-type]
        r2 = await client.post(
            f"/api/v1/team-chat/messages/{msg_id}/reactions/",
            json={"emoji": "👍"},
        )
        assert r2.status_code == 200
        assert r2.json()["metadata"]["reactions"]["👍"] == [m1_id, m2_id]

        r3 = await client.post(
            f"/api/v1/team-chat/messages/{msg_id}/reactions/",
            json={"emoji": "🎉"},
        )
        assert r3.status_code == 200
        assert r3.json()["metadata"]["reactions"] == {
            "👍": [m1_id, m2_id],
            "🎉": [m2_id],
        }

    # Member 1 removes 👍
    async with _build_client(session, await session.get(User, uuid.UUID(m1_id))) as client:  # type: ignore[arg-type]
        r4 = await client.post(
            f"/api/v1/team-chat/messages/{msg_id}/reactions/",
            json={"emoji": "👍"},
        )
        assert r4.status_code == 200
        assert r4.json()["metadata"]["reactions"] == {"👍": [m2_id], "🎉": [m2_id]}

    # Verify WS broadcasts fired `message.created` (quoted) + `message.edited` for every toggle.
    edited_events = [e for e in ws.events if e["event"] == "message.edited"]
    assert len(edited_events) == 4
    assert edited_events[-1]["message"]["id"] == str(msg_id)
    assert edited_events[-1]["message"]["metadata"]["reactions"] == {"👍": [m2_id], "🎉": [m2_id]}

    # Viewer lacks chat.write -> 403; outsider -> 404.
    async with c_viewer as client:
        r_v = await client.post(f"/api/v1/team-chat/messages/{msg_id}/reactions/", json={"emoji": "👍"})
        assert r_v.status_code == 403

    async with c_outsider as client:
        r_o = await client.post(f"/api/v1/team-chat/messages/{msg_id}/reactions/", json={"emoji": "👍"})
        assert r_o.status_code == 404


# ── 1.5: idempotent Mizito topic -> team_chat backfill script ────────────────


@pytest.mark.asyncio
async def test_1_5_backfill_mizito_topic_chat_dry_run_and_idempotent(session: AsyncSession) -> None:
    owner = await _make_user(session, role="admin", name="آرش پیرنیا")
    staff = await _make_user(session, role="editor", name="مهندس")
    p1, _t1 = await _make_project_with_team(session, owner, name="پیگیری اداری")
    p2, _t2 = await _make_project_with_team(session, owner, name="پروژه دیگر")

    doc_id = uuid.uuid4()
    topic_a = Task(project_id=p1.id, task_type="topic", title="گفتگوی پروژه")
    topic_b = Task(
        project_id=p1.id,
        task_type="task",
        title="گفتگوی متادیتایی",
        metadata_={"is_project_conversation": True},
    )
    normal_task = Task(project_id=p1.id, task_type="task", title="کار مهندسی عادی")
    other_topic = Task(project_id=p2.id, task_type="topic", title="گفتگوی پروژه ۲")
    session.add_all([topic_a, topic_b, normal_task, other_topic])
    await session.flush()

    t0 = datetime(2025, 11, 1, 9, 0, tzinfo=UTC)
    c_parent = Comment(
        entity_type="task",
        entity_id=str(topic_a.id),
        author_id=owner.id,
        text="سلام به همه",
        metadata_={"author_name": "آرش", "document_ids": [str(doc_id)]},
        created_at=t0,
    )
    await _add_and_flush(session, c_parent)

    c_child = Comment(
        entity_type="task",
        entity_id=str(topic_a.id),
        author_id=staff.id,
        text="چشم مدیر",
        parent_comment_id=c_parent.id,
        created_at=t0 + timedelta(minutes=2),
    )
    c_meta_conv = Comment(
        entity_type="task",
        entity_id=str(topic_b.id),
        author_id=staff.id,
        text="پیام دوم",
        created_at=t0 + timedelta(minutes=4),
    )
    c_deleted = Comment(
        entity_type="task",
        entity_id=str(topic_a.id),
        author_id=staff.id,
        text="حذف‌شده",
        is_deleted=True,
        created_at=t0 + timedelta(minutes=5),
    )
    c_normal = Comment(
        entity_type="task",
        entity_id=str(normal_task.id),
        author_id=staff.id,
        text="گزارش وظیفه عادی",
        created_at=t0 + timedelta(minutes=6),
    )
    c_p2 = Comment(
        entity_type="task",
        entity_id=str(other_topic.id),
        author_id=owner.id,
        text="پروژه ۲",
        created_at=t0 + timedelta(minutes=7),
    )
    session.add_all([c_child, c_meta_conv, c_deleted, c_normal, c_p2])
    await session.flush()

    # Dry-run writes nothing.
    dry = await backfill_topic_chat(session, project_id=p1.id, dry_run=True)
    assert dry.tasks_matched == 2
    assert dry.rooms_created == 1
    assert dry.messages_created == 3
    assert (await session.execute(select(ChatRoom).where(ChatRoom.project_id == p1.id))).scalars().first() is None

    # First run with --limit=1 inserts only the first chronological message.
    first_limited = await backfill_topic_chat(session, project_id=p1.id, limit=1, dry_run=False)
    assert first_limited.messages_created == 1
    assert first_limited.rooms_created == 1

    # Second run completes remaining 2 messages and links reply_to_id to first run's message.
    second_rest = await backfill_topic_chat(session, project_id=p1.id, dry_run=False)
    assert second_rest.messages_created == 2
    assert second_rest.messages_skipped == 1
    assert second_rest.rooms_created == 0
    assert second_rest.rooms_existing == 1

    # Third run creates 0 duplicates.
    third_noop = await backfill_topic_chat(session, project_id=p1.id, dry_run=False)
    assert third_noop.messages_created == 0
    assert third_noop.messages_skipped == 3

    room = (await session.execute(select(ChatRoom).where(ChatRoom.project_id == p1.id))).scalars().one()
    msgs = list(
        (
            await session.execute(
                select(ChatMessage).where(ChatMessage.room_id == room.id).order_by(ChatMessage.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
    assert [m.text for m in msgs] == ["سلام به همه", "چشم مدیر", "پیام دوم"]
    assert msgs[0].source_id == f"mizito-comment:{c_parent.id}"
    assert msgs[0].document_ids == [str(doc_id)]
    assert msgs[0].metadata_["author_name"] == "آرش"
    assert msgs[0].created_at.replace(tzinfo=UTC) == t0
    assert msgs[1].reply_to_id == msgs[0].id
    assert msgs[1].metadata_["author_name"] == "مهندس"

    # p2 was untouched when scoped to --project-id p1.id.
    assert (await session.execute(select(ChatRoom).where(ChatRoom.project_id == p2.id))).scalars().first() is None


async def _add_and_flush(session: AsyncSession, obj: object) -> None:
    session.add(obj)
    await session.flush()
