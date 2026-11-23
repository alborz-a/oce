"""Restricted project-user mode: letters (mailbox) are open to staff; other writes stay blocked."""

import pytest

from app.core.restricted_mode import is_path_allowed

P = "11111111-2222-3333-4444-555555555555"
L = "66666666-7777-8888-9999-000000000000"
D = "/api/v1/"


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", f"{D}correspondence/compose/"),
        ("GET", f"{D}correspondence/mailbox/"),
        ("GET", f"{D}correspondence/mailbox/unread-count/"),
        ("GET", f"{D}correspondence/unread-count/"),
        ("GET", f"{D}correspondence/{L}/thread/"),
        ("POST", f"{D}correspondence/{L}/reply/"),
        ("POST", f"{D}correspondence/{L}/forward/"),
        ("POST", f"{D}correspondence/{L}/archive/"),
        ("POST", f"{D}correspondence/{L}/unarchive/"),
        ("POST", f"{D}correspondence/{L}/read/"),
        ("GET", f"{D}correspondence/labels/"),
        ("POST", f"{D}correspondence/labels/"),
        ("POST", f"{D}correspondence/{L}/labels/{P}/"),
        ("DELETE", f"{D}correspondence/{L}/labels/{P}/"),
        ("POST", f"{D}correspondence/{L}/attachments/"),
        ("GET", f"{D}correspondence/{L}/attachments/0"),
    ],
)
def test_staff_letters_allowed(method, path):
    assert is_path_allowed(method, path)


@pytest.mark.parametrize(
    "method,path",
    [
        ("PATCH", f"{D}correspondence/{L}"),
        ("DELETE", f"{D}correspondence/{L}"),
        ("POST", f"{D}correspondence/"),
        ("POST", f"{D}correspondence/{L}/unknown/"),
        ("DELETE", f"{D}projects/{P}"),
    ],
)
def test_still_blocked(method, path):
    assert not is_path_allowed(method, path)
