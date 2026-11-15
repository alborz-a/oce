# DDC-CWICR-OE: DataDrivenConstruction / OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""RSD-0.46 E3 - photo description edit is limited to uploader, project manager, admin.

The PATCH ``/documents/photos/{id}`` route calls ``_can_edit_photo_description``;
these tests pin that rule. The project-manager lookup is replaced by a
monkeypatch so the test does not need team fixtures.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

import app.modules.bim_hub.models  # noqa: E402,F401
import app.modules.documents.models  # noqa: E402,F401
import app.modules.projects.models  # noqa: E402,F401
import app.modules.users.models  # noqa: E402,F401
from app.modules.documents.models import ProjectPhoto  # noqa: E402
from app.modules.documents.router import _can_edit_photo_description  # noqa: E402
from app.modules.projects.models import Project  # noqa: E402
from app.modules.users.models import User  # noqa: E402
from tests._pg import transactional_session  # noqa: E402


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    async with transactional_session() as sess:
        yield sess


async def _user(session: AsyncSession, role: str) -> User:
    user = User(
        email=f"u-{uuid.uuid4().hex[:8]}@test.io",
        hashed_password="x",
        full_name="Test User",
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _photo(session: AsyncSession, owner: User, uploader: User) -> ProjectPhoto:
    project = Project(
        name=f"Project {uuid.uuid4().hex[:6]}",
        owner_id=owner.id,
        currency="EUR",
        region="DE_BERLIN",
    )
    session.add(project)
    await session.flush()
    photo = ProjectPhoto(
        project_id=project.id,
        filename=f"photo-{uuid.uuid4().hex[:6]}.jpg",
        file_path=f"/tmp/{uuid.uuid4().hex}.jpg",
        category="site",
        created_by=str(uploader.id),
    )
    session.add(photo)
    await session.flush()
    return photo


def _no_pm(monkeypatch: pytest.MonkeyPatch, *, is_pm: bool) -> None:
    async def _fake(session, project_id, user_id) -> bool:  # noqa: ANN001
        return is_pm

    monkeypatch.setattr("app.modules.teams.access.is_project_manager", _fake)


@pytest.mark.tenant_isolation
@pytest.mark.asyncio
async def test_uploader_may_edit_description(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    _no_pm(monkeypatch, is_pm=False)
    owner = await _user(session, "editor")
    uploader = await _user(session, "editor")
    photo = await _photo(session, owner, uploader)
    assert await _can_edit_photo_description(photo, str(uploader.id), session) is True


@pytest.mark.tenant_isolation
@pytest.mark.asyncio
async def test_other_member_may_not_edit_description(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    """Negative control: a plain member who did not upload the photo is refused."""
    _no_pm(monkeypatch, is_pm=False)
    owner = await _user(session, "editor")
    uploader = await _user(session, "editor")
    stranger = await _user(session, "editor")
    photo = await _photo(session, owner, uploader)
    assert await _can_edit_photo_description(photo, str(stranger.id), session) is False


@pytest.mark.tenant_isolation
@pytest.mark.asyncio
async def test_project_manager_may_edit_description(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    _no_pm(monkeypatch, is_pm=True)
    owner = await _user(session, "editor")
    uploader = await _user(session, "editor")
    pm = await _user(session, "editor")
    photo = await _photo(session, owner, uploader)
    assert await _can_edit_photo_description(photo, str(pm.id), session) is True


@pytest.mark.tenant_isolation
@pytest.mark.asyncio
async def test_system_admin_may_edit_description(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    _no_pm(monkeypatch, is_pm=False)
    owner = await _user(session, "editor")
    uploader = await _user(session, "editor")
    admin = await _user(session, "admin")
    photo = await _photo(session, owner, uploader)
    assert await _can_edit_photo_description(photo, str(admin.id), session) is True


@pytest.mark.tenant_isolation
@pytest.mark.asyncio
async def test_missing_user_may_not_edit_description(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    _no_pm(monkeypatch, is_pm=True)
    owner = await _user(session, "editor")
    uploader = await _user(session, "editor")
    photo = await _photo(session, owner, uploader)
    assert await _can_edit_photo_description(photo, None, session) is False
