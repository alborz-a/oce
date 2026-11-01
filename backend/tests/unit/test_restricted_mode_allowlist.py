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
        ("POST", f"{D}documents/photos/upload/"),
        ("POST", f"{D}documents/upload/"),
        ("PATCH", f"{D}documents/photos/{P}"),
        ("GET", f"{D}search/"),
        ("GET", f"{D}search/status/"),
        ("GET", f"{D}search/types/"),
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
        ("GET", f"{D}boq/"),
        ("GET", f"{D}users/"),
    ],
)
def test_staff_denied(method, path):
    assert not is_path_allowed(method, path)


def test_search_types_narrowed():
    out = restrict_search_types(["oe_boq_positions", "oe_tasks", "oe_documents", "oe_chat"])
    assert out == ["oe_tasks", "oe_documents"]
