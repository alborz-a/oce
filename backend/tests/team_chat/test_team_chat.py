"""Team chat: access rules, paging, import idempotency, documents and live broadcast.

In-memory SQLite and fake sockets only (no network, no PostgreSQL).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.modules.team_chat import service as svc_mod
from app.modules.team_chat.hub import ChatHub, chat_hub
from app.modules.team_chat.schemas import ImportMessage, ImportRequest, ImportRoom
from app.modules.team_chat.service import TeamChatService

P1, P2 = uuid.uuid4(), uuid.uuid4()
ALICE, BOB, CAROL, ADMIN = (uuid.uuid4() for _ in range(4))
MEMBERS = {P1: {ALICE, BOB}, P2: {CAROL}}  # project -> users who may open it


@pytest.fixture
async def session():
    import app.modules.bim_hub.models  # noqa: F401
    import app.modules.documents.service  # noqa: F401
    import app.modules.notifications.models  # noqa: F401
    import app.modules.projects.models  # noqa: F401
    import app.modules.team_chat.models  # noqa: F401
    import app.modules.users.models  # noqa: F401
    from app.database import Base
    from app.modules.users.models import User

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    need: dict[str, object] = {}
    todo = [t for t in Base.metadata.sorted_tables if t.name.startswith(("oe_team_chat", "oe_documents", "oe_users_user", "oe_notifications", "oe_teams_", "oe_projects_project"))]
    while todo:
        t = todo.pop()
        if t.name not in need:
            need[t.name] = t
            todo += [fk.column.table for c in t.columns for fk in c.foreign_keys]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=list(need.values())))
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        for uid, name, role in ((ALICE, "آلیس", "editor"), (BOB, "باب", "viewer"), (CAROL, "کارول", "editor"),
                                (ADMIN, "ادمین", "admin")):
            s.add(User(id=uid, email=f"{name}@x.co", hashed_password="x", full_name=name, role=role))
        await s.flush()
        yield s
    await engine.dispose()


@pytest.fixture(autouse=True)
def project_access(monkeypatch):
    async def verify(project_id, user_id, session):
        u = uuid.UUID(str(user_id))
        if u != ADMIN and u not in MEMBERS.get(project_id, set()):
            raise HTTPException(status_code=404, detail="Project not found")

    async def accessible(session, user_id, **kw):
        u = uuid.UUID(str(user_id))
        return None if u == ADMIN else {p for p, m in MEMBERS.items() if u in m}

    monkeypatch.setattr(svc_mod, "verify_project_access", verify)
    monkeypatch.setattr(svc_mod, "accessible_project_ids", accessible)
    chat_hub.reset()


async def test_company_room_for_every_user_and_project_room_for_members_only(session):
    s = TeamChatService(session)
    room = await s.project_room(P1, ALICE)
    assert room.kind == "project" and room.project_id == P1
    again = await s.project_room(P1, BOB)
    assert again.id == room.id  # one room per project
    with pytest.raises(HTTPException) as e:
        await s.project_room(P1, CAROL)
    assert e.value.status_code == 404
    with pytest.raises(HTTPException):
        await s.post_message(room.id, CAROL, "hi", None, [], [])  # non-member cannot post
    with pytest.raises(HTTPException):
        await s.list_messages(room.id, CAROL, None, 10)
    kinds = {r["kind"] for r in await s.list_rooms(CAROL)}
    assert kinds == {"company"}
    assert {r["kind"] for r in await s.list_rooms(ALICE)} == {"company", "project"}
    assert {r["kind"] for r in await s.list_rooms(ADMIN)} >= {"company", "project"}


async def test_dm_is_invisible_to_third_parties_and_get_or_create(session):
    s = TeamChatService(session)
    dm = await s.create_room("dm", "", [ALICE, BOB], ALICE)
    assert (await s.create_room("dm", "", [BOB, ALICE], BOB)).id == dm.id
    await s.post_message(dm.id, ALICE, "سلام", None, [], [])
    from sqlalchemy import select

    from app.modules.notifications.models import Notification

    notes = list((await session.execute(select(Notification))).scalars())
    assert [(n.user_id, n.notification_type) for n in notes] == [(BOB, "chat_dm")]  # DM partner only, not the sender
    assert len(await s.list_messages(dm.id, BOB, None, 10)) == 1
    with pytest.raises(HTTPException) as e:
        await s.list_messages(dm.id, CAROL, None, 10)
    assert e.value.status_code == 404
    assert dm.id not in {r["id"] for r in await s.list_rooms(CAROL)}
    with pytest.raises(HTTPException):
        await s.create_room("dm", "", [BOB, CAROL], ALICE)  # a DM must include the caller


async def test_group_needs_membership_unless_manager(session):
    s = TeamChatService(session)
    with pytest.raises(HTTPException) as e:
        await s.create_room("group", "تیم", [BOB, CAROL], ALICE)
    assert e.value.status_code == 403
    g = await s.create_room("group", "تیم", [ALICE, BOB], ALICE)
    assert g.id in {r["id"] for r in await s.list_rooms(BOB)}


async def test_channel_listed_for_members_and_any_member_posts(session):
    s = TeamChatService(session)
    ch = await s.create_room("channel", "اعلان", [ALICE, BOB], ALICE)
    assert ch.kind == "channel"
    assert ch.id in {r["id"] for r in await s.list_rooms(BOB)}
    # plain member (not owner/manager) can post in a channel
    m_bob = await s.post_message(ch.id, BOB, "سلام", None, [], [])
    assert m_bob["text"] == "سلام"
    m_alice = await s.post_message(ch.id, ALICE, "خبر", None, [], [])
    assert m_alice["text"] == "خبر"
    # non-member is still refused by the membership check (404 "Room not found", not a post)
    with pytest.raises(HTTPException) as e:
        await s.post_message(ch.id, CAROL, "نه", None, [], [])
    assert e.value.status_code == 404


async def test_message_carries_author_title_from_registration(session):
    from app.modules.users.models import User

    s = TeamChatService(session)
    alice = await session.get(User, ALICE)
    alice.metadata_ = {"registration": {"job_title": "  مهندس  "}}
    company = await s.company_room()
    m_alice = await s.post_message(company.id, ALICE, "الف", None, [], [])
    m_bob = await s.post_message(company.id, BOB, "ب", None, [], [])
    assert m_alice["author_title"] == "مهندس"
    assert m_bob["author_title"] is None


async def test_message_carries_author_avatar_url_or_null(session):
    from app.modules.users.models import User

    s = TeamChatService(session)
    alice = await session.get(User, ALICE)
    alice.avatar_path = "avatars/alice.jpg"
    bob = await session.get(User, BOB)
    bob.avatar_path = None
    company = await s.company_room()
    m_alice = await s.post_message(company.id, ALICE, "الف", None, [], [])
    m_bob = await s.post_message(company.id, BOB, "ب", None, [], [])
    assert m_alice["avatar_url"] == alice.avatar_url
    assert m_alice["avatar_url"].startswith(f"/api/v1/users/{ALICE}/avatar")
    assert m_bob["avatar_url"] is None


async def test_list_colleagues_excludes_self_inactive_and_hidden(session):
    from app.modules.users.models import User

    session.add(User(id=uuid.uuid4(), email="gone@x.co", hashed_password="x", full_name="غایب", role="viewer", is_active=False))
    hidden = uuid.uuid4()
    session.add(User(id=hidden, email="qa.hidden@x.co", hashed_password="x", full_name="qa.hidden", role="viewer", is_active=True))
    await session.flush()
    await _share(session, P1, ALICE, [ALICE, BOB, hidden])
    s = TeamChatService(session)
    names = {c.full_name for c in await s.list_colleagues(BOB)}
    assert "باب" not in names and "غایب" not in names and "qa.hidden" not in names
    assert "آلیس" in names
    assert hidden not in {c.id for c in await s.list_colleagues(BOB, {"role": "viewer"})}
    assert hidden in {c.id for c in await s.list_colleagues(ADMIN, {"role": "admin"})}


async def test_list_colleagues_carries_avatar_url(session):
    from app.modules.users.models import User

    with_photo = uuid.uuid4()
    session.add(User(id=with_photo, email="photo.colleague@x.co", hashed_password="x", full_name="عکس دار", role="viewer", is_active=True, avatar_path="avatars/p.jpg"))
    await session.flush()
    await _share(session, P1, ALICE, [ALICE, BOB, with_photo])
    expected = await session.get(User, with_photo)
    cols = {c.id: c for c in await TeamChatService(session).list_colleagues(BOB)}
    assert cols[with_photo].avatar_url == expected.avatar_url and cols[with_photo].avatar_url.startswith(f"/api/v1/users/{with_photo}/avatar")
    assert cols[ALICE].avatar_url is None


async def _share(session, project_id, owner, members):
    """Create project (if missing), one team and memberships in the real teams tables."""
    from app.modules.projects.models import Project
    from app.modules.teams.models import Team, TeamMembership

    if await session.get(Project, project_id) is None:
        session.add(Project(id=project_id, name=f"project {project_id.hex[:6]}", owner_id=owner))
        await session.flush()
    team = Team(id=uuid.uuid4(), project_id=project_id, name="team")
    session.add(team)
    await session.flush()
    for uid in members:
        session.add(TeamMembership(team_id=team.id, user_id=uid, role="member"))
    await session.flush()


async def test_colleagues_only_from_shared_projects(session):
    from app.modules.users.models import User

    dan = uuid.uuid4()
    session.add(User(id=dan, email="dan@x.co", hashed_password="x", full_name="دان", role="viewer", is_active=True))
    await session.flush()
    await _share(session, P1, ALICE, [ALICE, BOB])  # BOB shares P1 with ALICE
    await _share(session, P2, CAROL, [CAROL, dan])  # CAROL and dan share P2, BOB is outside
    names = {c.id for c in await TeamChatService(session).list_colleagues(BOB, {"role": "viewer"})}
    assert ALICE in names
    assert CAROL not in names and dan not in names


async def test_project_owner_of_shared_project_is_visible(session):
    dan = uuid.uuid4()
    from app.modules.users.models import User

    session.add(User(id=dan, email="dan2@x.co", hashed_password="x", full_name="دان۲", role="viewer", is_active=True))
    await session.flush()
    await _share(session, P1, CAROL, [BOB, dan])  # owner CAROL is not a member but owns P1
    ids = {c.id for c in await TeamChatService(session).list_colleagues(BOB, {"role": "viewer"})}
    assert CAROL in ids and dan in ids


async def test_user_without_projects_sees_no_colleagues(session):
    from app.modules.users.models import User

    eve = uuid.uuid4()
    session.add(User(id=eve, email="eve@x.co", hashed_password="x", full_name="ایو", role="viewer", is_active=True))
    await session.flush()
    await _share(session, P1, ALICE, [ALICE, BOB])
    assert await TeamChatService(session).list_colleagues(eve, {"role": "viewer"}) == []


async def test_admin_sees_every_active_user(session):
    await _share(session, P1, ALICE, [ALICE, BOB])
    ids = {c.id for c in await TeamChatService(session).list_colleagues(ADMIN, {"role": "admin"})}
    assert {ALICE, BOB, CAROL} <= ids and ADMIN not in ids


async def test_project_id_param_scopes_and_refuses_foreign_project(session):
    await _share(session, P1, ALICE, [ALICE, BOB])
    await _share(session, P2, CAROL, [CAROL])
    s = TeamChatService(session)
    own = {c.id for c in await s.list_colleagues(BOB, {"role": "viewer"}, P1)}
    assert own == {ALICE}
    assert await s.list_colleagues(BOB, {"role": "viewer"}, P2) == []


async def test_paging_oldest_first_with_before_cursor(session):
    s = TeamChatService(session)
    company = await s.company_room()
    ids = []
    for i in range(12):
        m = await s.post_message(company.id, ALICE, f"m{i}", None, [], [])
        ids.append(m["id"])
    page1 = await s.list_messages(company.id, BOB, None, 5)
    assert [m["text"] for m in page1] == ["m7", "m8", "m9", "m10", "m11"]
    page2 = await s.list_messages(company.id, BOB, page1[0]["id"], 5)
    assert [m["text"] for m in page2] == ["m2", "m3", "m4", "m5", "m6"]


async def test_unread_counts_and_mark_read(session):
    s = TeamChatService(session)
    company = await s.company_room()
    await s.post_message(company.id, ALICE, "one", None, [], [])
    await s.post_message(company.id, ALICE, "two", None, [], [])
    row = next(r for r in await s.list_rooms(BOB) if r["id"] == company.id)
    assert row["unread"] == 2
    await s.mark_read(company.id, BOB)
    assert next(r for r in await s.list_rooms(BOB) if r["id"] == company.id)["unread"] == 0
    assert next(r for r in await s.list_rooms(ALICE) if r["id"] == company.id)["unread"] == 0  # own messages


async def test_edit_only_by_author(session):
    s = TeamChatService(session)
    company = await s.company_room()
    m = await s.post_message(company.id, ALICE, "typo", None, [], [])
    with pytest.raises(HTTPException) as e:
        await s.edit_message(m["id"], BOB, "hijack")
    assert e.value.status_code == 403
    out = await s.edit_message(m["id"], ALICE, "fixed")
    assert out["text"] == "fixed" and out["edited_at"] is not None


async def test_import_is_idempotent_and_keeps_authors_and_dates(session):
    s = TeamChatService(session)
    t0 = datetime(2022, 3, 1, 8, 30, tzinfo=UTC)
    req = ImportRequest(rooms=[ImportRoom(kind="company", messages=[
        ImportMessage(source_id="c:1", author_id=ALICE, text="قدیمی", created_at=t0),
        ImportMessage(source_id="c:2", author_id=None, author_name="کسی", text="دوم", created_at=t0 + timedelta(minutes=5),
                      reply_to_source_id="c:1"),
    ])])
    r1 = await s.import_history(req, ADMIN)
    r2 = await s.import_history(req, ADMIN)
    assert (r1.messages_created, r2.messages_created, r2.messages_skipped) == (2, 0, 2)
    msgs = await s.list_messages((await s.company_room()).id, BOB, None, 10)
    assert [m["text"] for m in msgs] == ["قدیمی", "دوم"]
    assert msgs[0]["created_at"].replace(tzinfo=UTC) == t0 and msgs[0]["author_id"] == ALICE
    assert msgs[1]["author_name"] == "کسی" and msgs[1]["reply_to_id"] == msgs[0]["id"]
    # project and group and dm imports
    r3 = await s.import_history(ImportRequest(rooms=[
        ImportRoom(kind="project", project_id=P1, messages=[ImportMessage(source_id="p:1", text="x", created_at=t0)]),
        ImportRoom(kind="group", source_id="g1", name="گروه", member_ids=[ALICE, BOB],
                   messages=[ImportMessage(source_id="g:1", text="y", created_at=t0)]),
        ImportRoom(kind="dm", member_ids=[ALICE, BOB], messages=[ImportMessage(source_id="d:1", text="z", created_at=t0)]),
    ]), ADMIN)
    assert r3.rooms_created == 3 and r3.messages_created == 3


async def test_document_from_another_project_is_refused_but_linked_documents_work(session):
    from app.modules.documents.models import Document

    s = TeamChatService(session)
    room = await s.project_room(P1, ALICE)
    mine = Document(project_id=P1, name="a.pdf", category="other", file_size=1, mime_type="", file_path="s3:x",
                    uploaded_by="u")
    foreign = Document(project_id=P2, name="b.pdf", category="other", file_size=1, mime_type="", file_path="s3:y",
                       uploaded_by="u")
    session.add_all([mine, foreign])
    await session.flush()
    ok = await s.post_message(room.id, ALICE, "", None, [mine.id], [])
    assert ok["document_ids"] == [mine.id]
    with pytest.raises(HTTPException) as e:
        await s.post_message(room.id, ALICE, "no", None, [foreign.id], [])
    assert e.value.status_code == 400
    # import carries linked document ids (any existing document) so file messages become real documents
    r = await s.import_history(ImportRequest(rooms=[ImportRoom(kind="project", project_id=P1, messages=[
        ImportMessage(source_id="f:1", text="فایل", created_at=datetime(2022, 1, 1, tzinfo=UTC),
                      document_ids=[mine.id])])]), ADMIN)
    assert r.messages_created == 1
    msgs = await s.list_messages(room.id, ALICE, None, 10)
    assert any(m["document_ids"] == [mine.id] for m in msgs)
    with pytest.raises(HTTPException):
        await s.import_history(ImportRequest(rooms=[ImportRoom(kind="company", messages=[
            ImportMessage(source_id="f:2", text="?", created_at=datetime(2022, 1, 1, tzinfo=UTC),
                          document_ids=[uuid.uuid4()])])]), ADMIN)


class FakeWS:
    def __init__(self):
        self.sent = []

    async def send_json(self, data):
        self.sent.append(data)


async def test_broadcast_reaches_only_subscribed_sockets(session):
    s = TeamChatService(session)
    company = await s.company_room()
    a, b = FakeWS(), FakeWS()
    await chat_hub.join(a, ALICE)
    await chat_hub.join(b, BOB)
    await chat_hub.subscribe(a, {company.id})
    await s.post_message(company.id, BOB, "live", None, [], [])
    assert [e["event"] for e in a.sent] == ["message.created"]
    assert a.sent[0]["message"]["text"] == "live" and a.sent[0]["message"]["author_id"] == str(BOB)
    assert b.sent == []


async def test_hub_scrubs_dead_sockets():
    class Dead:
        async def send_json(self, data):
            raise RuntimeError("gone")

    hub = ChatHub()
    d = Dead()
    rid = uuid.uuid4()
    await hub.join(d, ALICE)
    await hub.subscribe(d, {rid})
    assert await hub.broadcast(rid, {"event": "x"}) == 0
    assert hub.connection_count() == 0
