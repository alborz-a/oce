"""Integration tests: a team ``project_manager`` can manage members of THAT project.

Covers the member endpoints on the ``oe_projects`` router:

    POST   /api/v1/projects/{project_id}/members/
    POST   /api/v1/projects/{project_id}/members/bulk/
    DELETE /api/v1/projects/{project_id}/members/{user_id}/

Test matrix:

    * project_manager adds a basic-role member -> 201
    * project_manager removes a member -> 204
    * project_manager cannot grant ELEVATED roles (owner / project_manager) -> 403
    * plain ``member`` team role cannot add members -> 403
    * project_manager cannot delete the project itself -> 403
    * project_manager of project X cannot add members to project Y -> 403

Uses the PostgreSQL isolation pattern from ``feedback_test_isolation.md``.
"""

from __future__ import annotations

import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.dependencies import (
    get_current_user_id,
    get_current_user_payload,
    get_session,
)
from tests._pg import isolated_engine


@pytest_asyncio.fixture
async def temp_engine_and_factory():
    """Per-test throwaway PostgreSQL database, cloned from the schema-loaded template."""
    async with isolated_engine() as engine:
        factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        yield engine, factory


@pytest_asyncio.fixture
async def seeded_ids(temp_engine_and_factory) -> dict[str, str]:
    """Seed owner, project manager, plain member, invitee, and two projects.

    Project X is owned by ``owner`` and managed by ``pm`` (team role
    ``project_manager``); ``member`` has the basic ``member`` role on X.
    Project Y is owned by ``owner`` and ``pm`` has no membership on it.
    """
    _engine, factory = temp_engine_and_factory
    from app.modules.projects.models import Project
    from app.modules.teams.models import Team, TeamMembership
    from app.modules.users.models import User

    def _user(label: str, name: str) -> User:
        return User(
            email=f"{label}-{uuid.uuid4().hex[:6]}@test.io",
            hashed_password="x",
            full_name=name,
        )

    async with factory() as session:
        owner = _user("owner", "Test Owner")
        pm = _user("pm", "Project Manager")
        member = _user("member", "Basic Member")
        invitee = _user("invitee", "Invitee User")
        session.add_all([owner, pm, member, invitee])
        await session.flush()

        project_x = Project(name="PM Test X", owner_id=owner.id)
        project_y = Project(name="PM Test Y", owner_id=owner.id)
        session.add_all([project_x, project_y])
        await session.flush()

        team_x = Team(project_id=project_x.id, name="Default Team", is_default=True)
        team_y = Team(project_id=project_y.id, name="Default Team", is_default=True)
        session.add_all([team_x, team_y])
        await session.flush()

        session.add_all(
            [
                TeamMembership(team_id=team_x.id, user_id=owner.id, role="lead"),
                TeamMembership(team_id=team_x.id, user_id=pm.id, role="project_manager"),
                TeamMembership(team_id=team_x.id, user_id=member.id, role="member"),
                TeamMembership(team_id=team_y.id, user_id=owner.id, role="lead"),
            ]
        )
        await session.commit()

        return {
            "owner_id": str(owner.id),
            "pm_id": str(pm.id),
            "member_id": str(member.id),
            "invitee_id": str(invitee.id),
            "project_id": str(project_x.id),
            "other_project_id": str(project_y.id),
        }


def _build_app(factory, current_user_id: str, role: str = "editor") -> FastAPI:
    """Build a minimal FastAPI app with only the projects router mounted."""
    from app.modules.projects.router import router as projects_router

    app = FastAPI()
    app.include_router(projects_router, prefix="/api/v1/projects")

    async def _override_session() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def _override_user_id() -> str:
        return current_user_id

    async def _override_user_payload() -> dict:
        return {"sub": current_user_id, "role": role}

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user_id] = _override_user_id
    app.dependency_overrides[get_current_user_payload] = _override_user_payload
    return app


def _client_for(temp_engine_and_factory, user_id: str):
    _engine, factory = temp_engine_and_factory
    transport = ASGITransport(app=_build_app(factory, user_id))
    return AsyncClient(transport=transport, base_url="http://test")


@pytest_asyncio.fixture
async def pm_client(temp_engine_and_factory, seeded_ids) -> AsyncGenerator[AsyncClient, None]:
    async with _client_for(temp_engine_and_factory, seeded_ids["pm_id"]) as ac:
        yield ac


@pytest_asyncio.fixture
async def member_client(temp_engine_and_factory, seeded_ids) -> AsyncGenerator[AsyncClient, None]:
    async with _client_for(temp_engine_and_factory, seeded_ids["member_id"]) as ac:
        yield ac


# ── Tests ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_project_manager_can_add_basic_member(pm_client: AsyncClient, seeded_ids: dict[str, str]):
    """project_manager adds a basic-role member to their project -> 201."""
    pid = seeded_ids["project_id"]
    resp = await pm_client.post(
        f"/api/v1/projects/{pid}/members/",
        json={"user_id": seeded_ids["invitee_id"], "role": "estimator"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["user_id"] == seeded_ids["invitee_id"]


@pytest.mark.asyncio
async def test_project_manager_can_remove_member(pm_client: AsyncClient, seeded_ids: dict[str, str]):
    """project_manager removes the plain member from their project -> 204."""
    pid = seeded_ids["project_id"]
    delete = await pm_client.delete(f"/api/v1/projects/{pid}/members/{seeded_ids['member_id']}/")
    assert delete.status_code == 204, delete.text


@pytest.mark.asyncio
async def test_project_manager_cannot_grant_elevated_roles(pm_client: AsyncClient, seeded_ids: dict[str, str]):
    """Only owner/admin may hand out owner or project_manager roles -> 403."""
    pid = seeded_ids["project_id"]
    for role in ("owner", "project_manager"):
        resp = await pm_client.post(
            f"/api/v1/projects/{pid}/members/",
            json={"user_id": seeded_ids["invitee_id"], "role": role},
        )
        assert resp.status_code == 403, f"{role}: {resp.text}"
        assert "owner" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_project_manager_cannot_grant_elevated_role_in_bulk(pm_client: AsyncClient, seeded_ids: dict[str, str]):
    """The bulk endpoint applies the same elevated-role gate -> 403."""
    pid = seeded_ids["project_id"]
    resp = await pm_client.post(
        f"/api/v1/projects/{pid}/members/bulk/",
        json={"members": [{"user_id": seeded_ids["invitee_id"], "role": "project_manager"}]},
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_plain_member_cannot_add_members(member_client: AsyncClient, seeded_ids: dict[str, str]):
    """A plain ``member`` team role has no manager rights -> 403."""
    pid = seeded_ids["project_id"]
    resp = await member_client.post(
        f"/api/v1/projects/{pid}/members/",
        json={"user_id": seeded_ids["invitee_id"], "role": "viewer"},
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_project_manager_cannot_delete_project(pm_client: AsyncClient, seeded_ids: dict[str, str]):
    """Deleting the project itself stays owner/admin only -> 403."""
    pid = seeded_ids["project_id"]
    resp = await pm_client.delete(f"/api/v1/projects/{pid}")
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_project_manager_of_x_cannot_add_members_to_y(pm_client: AsyncClient, seeded_ids: dict[str, str]):
    """Manager rights are per project: no membership on Y -> 403."""
    pid = seeded_ids["other_project_id"]
    resp = await pm_client.post(
        f"/api/v1/projects/{pid}/members/",
        json={"user_id": seeded_ids["invitee_id"], "role": "viewer"},
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_project_manager_can_list_member_candidates(pm_client: AsyncClient, seeded_ids: dict[str, str]):
    """The add-member picker list is open to the project_manager and holds only id/email/full_name."""
    pid = seeded_ids["project_id"]
    resp = await pm_client.get(f"/api/v1/projects/{pid}/member-candidates/")
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert seeded_ids["invitee_id"] in {r["id"] for r in rows}
    assert all(set(r) == {"id", "email", "full_name"} for r in rows)


@pytest.mark.asyncio
async def test_plain_member_cannot_list_member_candidates(member_client: AsyncClient, seeded_ids: dict[str, str]):
    """A plain member never gets the user list -> 403."""
    pid = seeded_ids["project_id"]
    resp = await member_client.get(f"/api/v1/projects/{pid}/member-candidates/")
    assert resp.status_code == 403, resp.text
