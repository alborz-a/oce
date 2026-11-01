"""S8 backend (hide the Mizito importer from non-admins) and admin user-update schema (mobile, email)."""

import pytest
from pydantic import ValidationError

from app.core.hidden_users import is_hidden_system_user, viewer_is_admin
from app.modules.projects.member_schemas import ProjectMemberResponse
from app.modules.projects.member_service import present_members
from app.modules.users.schemas import UserAdminUpdate
import uuid
from datetime import datetime, timezone


def _m(email, name, role="member", owner=False):
    return ProjectMemberResponse(
        user_id=uuid.uuid4(), email=email, full_name=name, role=role, is_owner=owner,
        created_at=datetime.now(timezone.utc),
    )


def _team():
    return [
        _m("mizito-importer@royalstars.co", "Mizito Importer", "owner", True),
        _m("a.pirnia@royalstars.co", "Arash Pirnia", "project_manager"),
        _m("p.pourbijan@royalstars.co", "Parima Pourbijan"),
    ]


def test_non_admin_does_not_see_importer_and_manager_is_owner():
    out = present_members(_team(), viewer_is_admin=False)
    assert [m.full_name for m in out] == ["Arash Pirnia", "Parima Pourbijan"]
    assert [m.is_owner for m in out] == [True, False]


def test_admin_sees_everything_unchanged():
    out = present_members(_team(), viewer_is_admin=True)
    assert len(out) == 3 and out[0].is_owner is True


def test_hidden_detection_and_admin_payload():
    assert is_hidden_system_user("MIZITO-importer@royalstars.co", None)
    assert is_hidden_system_user(None, "Mizito Importer")
    assert not is_hidden_system_user("a@b.co", "Arash")
    assert viewer_is_admin({"role": "admin"}) and not viewer_is_admin({"role": "editor"})


def test_admin_update_normalizes_mobile_and_email():
    u = UserAdminUpdate(mobile="+98 912 345 6789", email="A.Pirnia@RoyalStars.co")
    assert u.mobile == "09123456789" and u.email == "a.pirnia@royalstars.co"
    assert UserAdminUpdate(mobile="").mobile == ""
    with pytest.raises(ValidationError):
        UserAdminUpdate(mobile="123")
