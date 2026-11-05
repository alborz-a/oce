"""Allow-list tests for restricted project-user mode (staff)."""

import pytest

from app.core.restricted_mode import (
    is_path_allowed,
    restrict_search_types,
)

P = "11111111-2222-3333-4444-555555555555"
D = "/api/v1/"


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", f"{D}projects/{P}/files/"),
        ("GET", f"{D}projects/{P}/files/tree/"),
        ("GET", f"{D}projects/{P}/files/locations/"),
        ("GET", f"{D}documents/photos/"),
        ("GET", f"{D}documents/photos/recent/"),
        ("GET", f"{D}documents/photos/{P}/thumb/"),
        ("GET", f"{D}documents/{P}/download/"),
        ("GET", f"{D}documents/{P}/activity/"),
        ("GET", f"{D}file-tags/by-file/"),
        ("POST", f"{D}documents/photos/upload/"),
        ("POST", f"{D}documents/upload/"),
        ("PATCH", f"{D}documents/photos/{P}"),
        ("GET", f"{D}search/"),
        ("GET", f"{D}search/status/"),
        ("GET", f"{D}search/types/"),
        ("GET", f"{D}ai-estimator/embedding-model/status"),
        ("GET", f"{D}ai-estimator/embedding-model/status/"),
        ("GET", f"{D}users/{P}/avatar"),
        ("GET", f"{D}users/{P}/avatar/"),
    ],
)
def test_staff_allowed(method, path):
    assert is_path_allowed(method, path)


@pytest.mark.parametrize(
    "method,path",
    [
        ("DELETE", f"{D}documents/photos/{P}"),
        ("DELETE", f"{D}documents/{P}"),
        ("POST", f"{D}projects/{P}/files/"),
        ("DELETE", f"{D}projects/{P}/files/"),
        ("POST", f"{D}search/"),
        ("POST", f"{D}documents/sheets/split-pdf/"),
        ("POST", f"{D}documents/{P}/activity/"),
        ("POST", f"{D}file-tags/by-file/"),
        ("GET", f"{D}file-tags/"),
        ("GET", f"{D}boq/"),
        ("POST", f"{D}ai-estimator/embedding-model/install"),
        ("PUT", f"{D}ai-estimator/embedding-model/enabled"),
        ("GET", f"{D}users/"),
        ("PUT", f"{D}users/{P}/avatar"),
        ("DELETE", f"{D}users/{P}/avatar"),
    ],
)
def test_staff_denied(method, path):
    assert not is_path_allowed(method, path)


def test_search_types_narrowed():
    out = restrict_search_types(["oe_boq_positions", "oe_tasks", "oe_documents", "oe_chat"])
    assert out == ["oe_tasks", "oe_documents"]


def test_search_router_boq_only_returns_nothing_for_staff(monkeypatch):
    import asyncio

    from app.modules.search import router as search_router

    async def _restricted(session, user_id):
        return True

    async def _must_not_run(*args, **kwargs):
        raise AssertionError("service must not run when no allowed type remains")

    monkeypatch.setattr(search_router, "_caller_is_restricted", _restricted)
    monkeypatch.setattr(search_router, "unified_search_service", _must_not_run)

    res = asyncio.run(
        search_router.unified_search_endpoint(
            _user_id="u",
            session=None,
            q="beton",
            types=["boq"],
            project_id=None,
            tenant_id=None,
            limit_per_collection=10,
            final_limit=25,
        )
    )
    assert res.total == 0
    assert res.hits == []
    assert res.types == []
