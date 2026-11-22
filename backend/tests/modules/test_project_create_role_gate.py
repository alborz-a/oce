"""Project creation (create and duplicate) is limited to global manager and admin."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from app.dependencies import RequireRole
from app.modules.projects import router as projects_router


def _gate(role: str) -> None:
    asyncio.run(RequireRole("manager")(payload={"role": role}))


@pytest.mark.parametrize("role", ["editor", "viewer"])
def test_editor_and_viewer_are_refused(role: str) -> None:
    with pytest.raises(HTTPException) as exc:
        _gate(role)
    assert exc.value.status_code == 403


@pytest.mark.parametrize("role", ["manager", "admin"])
def test_manager_and_admin_pass_gate(role: str) -> None:
    assert _gate(role) is None


def _route_dependencies(path: str, method: str) -> list:
    for route in projects_router.router.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return list(route.dependencies)
    raise AssertionError(f"route {method} {path} not found")


@pytest.mark.parametrize(
    ("path", "method"),
    [("/", "POST"), ("/{project_id}/duplicate/", "POST")],
)
def test_create_routes_carry_manager_role_gate(path: str, method: str) -> None:
    deps = _route_dependencies(path, method)
    gates = [d for d in deps if isinstance(getattr(d, "dependency", None), RequireRole)]
    assert gates, f"{method} {path} has no RequireRole dependency"
    assert gates[0].dependency.required == "manager"
