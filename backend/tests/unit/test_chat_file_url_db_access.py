"""chat-file-url access on a real sqlite DB: real verify_project_access and real membership rows.

Only the DB is a sqlite test session and the object-store presign is stubbed. Member gets a URL, a non-member
gets 404 (verify_project_access hides project existence with 404, not 403), an unmapped key gets 404 for non-admin.
"""

import uuid
from collections.abc import AsyncIterator

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.modules.documents import object_store
from app.modules.documents import router as documents_router

KEY = "mizito/general/chats/aa11/files/bb22__x.jpg"
PHOTO_PATH = "/data/photos/" + KEY
PROJECT_ID = uuid.UUID("11111111-aaaa-0000-0000-000000000001")
OWNER_ID = uuid.UUID("11111111-aaaa-0000-0000-000000000002")
MEMBER_ID = uuid.UUID("11111111-aaaa-0000-0000-000000000003")
OUTSIDER_ID = uuid.UUID("11111111-aaaa-0000-0000-000000000004")


class _Backend:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def url_for(self, key: str, expires_in: int, **_: object) -> str:
        self.calls.append(key)
        return f"https://bucket.example/{key}?sig=x"


@pytest.fixture
async def db() -> AsyncIterator[AsyncSession]:
    import app.modules.documents.models  # noqa: F401
    import app.modules.projects.models  # noqa: F401
    import app.modules.teams.models  # noqa: F401
    import app.modules.users.models  # noqa: F401
    from app.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    need: dict[str, object] = {}
    todo = [
        t
        for t in Base.metadata.sorted_tables
        if t.name.startswith(("oe_projects", "oe_teams", "oe_documents", "oe_users_user"))
    ]
    while todo:
        t = todo.pop()
        if t.name not in need:
            need[t.name] = t
            todo += [fk.column.table for c in t.columns for fk in c.foreign_keys]  # type: ignore[misc]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=list(need.values())))  # type: ignore[arg-type]
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


@pytest.mark.asyncio
async def test_chat_file_url_member_200_non_member_and_unmapped_404(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.documents.models import ProjectPhoto
    from app.modules.projects.models import Project
    from app.modules.teams.models import Team, TeamMembership
    from app.modules.users.models import User

    backend = _Backend()
    monkeypatch.setattr(object_store, "_imported_s3", lambda: backend)

    for uid, name in ((OWNER_ID, "owner"), (MEMBER_ID, "member"), (OUTSIDER_ID, "outsider")):
        db.add(User(id=uid, email=f"{name}@x.co", hashed_password="x", full_name=name, role="editor"))
    await db.flush()
    team_id = uuid.uuid4()
    db.add(Project(id=PROJECT_ID, name="p", owner_id=OWNER_ID))
    db.add(Team(id=team_id, project_id=PROJECT_ID, name="team"))
    db.add(TeamMembership(team_id=team_id, user_id=MEMBER_ID))
    db.add(
        ProjectPhoto(
            project_id=PROJECT_ID,
            filename="x.jpg",
            file_path=PHOTO_PATH,
            tags=[],
            metadata_={},
        )
    )
    await db.flush()

    with pytest.raises(HTTPException) as outsider:
        await documents_router.chat_file_url(user_id=str(OUTSIDER_ID), session=db, key=KEY)
    assert outsider.value.status_code == 404
    assert backend.calls == []

    res = await documents_router.chat_file_url(user_id=str(MEMBER_ID), session=db, key=KEY)
    assert res.url is not None
    assert backend.calls == ["general/chats/aa11/files/bb22__x.jpg"]

    with pytest.raises(HTTPException) as unmapped:
        await documents_router.chat_file_url(
            user_id=str(MEMBER_ID), session=db, key="mizito/general/chats/aa11/files/none.jpg"
        )
    assert unmapped.value.status_code == 404
    assert len(backend.calls) == 1
