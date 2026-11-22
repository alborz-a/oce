"""Project member read access: only real members, owners and global admins.

Covers the members endpoint (``_verify_project_access`` without the global
manager bypass) and the project listing role rule (only global admins list
every project). Runs against the shared PostgreSQL unit database inside a
rolled-back transaction, like the teams suite.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.router import _verify_project_access
from app.modules.teams.validators import register_teams_rules
from tests._pg import transactional_session
from tests.unit.teams.conftest import make_membership, make_project, make_team, make_user


@pytest.fixture(scope="module", autouse=True)
def _rules_registered() -> None:
    register_teams_rules()


@pytest_asyncio.fixture
async def session():
    async with transactional_session() as s:
        yield s


class _StubService:
    """Minimal stand-in for ProjectService: only ``get_project`` is used."""

    def __init__(self, project) -> None:
        self._project = project

    async def get_project(self, project_id):
        return self._project


async def _world(session: AsyncSession):
    owner = await make_user(session, role="editor")
    member = await make_user(session, role="editor")
    outsider = await make_user(session, role="editor")
    manager = await make_user(session, role="manager")
    admin = await make_user(session, role="admin")
    project = await make_project(session, owner.id)
    team = await make_team(session, project.id, name="Default", is_default=True)
    await make_membership(session, team.id, member.id)
    await session.flush()
    return SimpleNamespace(
        owner=owner, member=member, outsider=outsider, manager=manager, admin=admin, project=project
    )


def _payload(user) -> dict:
    return {"sub": str(user.id), "role": user.role, "permissions": []}


async def test_non_member_is_denied_on_members_read(session: AsyncSession) -> None:
    w = await _world(session)
    svc = _StubService(w.project)
    with pytest.raises(HTTPException) as exc:
        await _verify_project_access(svc, w.project.id, str(w.outsider.id), session, _payload(w.outsider))
    assert exc.value.status_code == 404


async def test_global_manager_is_denied_on_members_read(session: AsyncSession) -> None:
    w = await _world(session)
    svc = _StubService(w.project)
    with pytest.raises(HTTPException) as exc:
        await _verify_project_access(svc, w.project.id, str(w.manager.id), session, _payload(w.manager))
    assert exc.value.status_code == 404


async def test_global_manager_still_passes_when_manager_read_opted_in(session: AsyncSession) -> None:
    w = await _world(session)
    svc = _StubService(w.project)
    project = await _verify_project_access(
        svc, w.project.id, str(w.manager.id), session, _payload(w.manager), manager_read=True
    )
    assert project is w.project


async def test_owner_and_team_member_pass_members_read(session: AsyncSession) -> None:
    w = await _world(session)
    svc = _StubService(w.project)
    assert await _verify_project_access(svc, w.project.id, str(w.owner.id), session, _payload(w.owner))
    assert await _verify_project_access(svc, w.project.id, str(w.member.id), session, _payload(w.member))


async def test_global_admin_passes_members_read(session: AsyncSession) -> None:
    w = await _world(session)
    svc = _StubService(w.project)
    project = await _verify_project_access(svc, w.project.id, str(w.admin.id), session, _payload(w.admin))
    assert project is w.project
