"""Only a system admin may change a full name through PATCH /users/me/."""

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.users.router import update_me
from app.modules.users.schemas import UserUpdate


class _Svc:
    def __init__(self, role: str, name: str = "Old Name") -> None:
        self.user = SimpleNamespace(
            id=uuid.uuid4(), role=role, full_name=name, email="a@b.co", is_active=True,
            metadata_={}, locale="fa", created_at=None, last_login_at=None,
        )
        self.updated: dict | None = None

    async def get_user(self, _id):
        return self.user

    async def update_profile(self, _id, **fields):
        self.updated = fields
        for k, v in fields.items():
            setattr(self.user, k, v)
        return self.user


async def _call(svc, **body):
    try:
        return await update_me(UserUpdate(**body), str(svc.user.id), svc)
    except HTTPException:
        raise
    except Exception:
        # response model validation may need fields the stub lacks; the update call is what matters
        return None


@pytest.mark.asyncio
async def test_staff_cannot_rename():
    svc = _Svc("editor")
    with pytest.raises(HTTPException) as ei:
        await _call(svc, full_name="New Name")
    assert ei.value.status_code == 403
    assert svc.updated is None


@pytest.mark.asyncio
async def test_staff_same_name_ignored():
    svc = _Svc("editor")
    await _call(svc, full_name="Old Name", locale="en")
    assert svc.updated is not None and "full_name" not in svc.updated


@pytest.mark.asyncio
async def test_admin_can_rename():
    svc = _Svc("admin")
    await _call(svc, full_name="New Name")
    assert svc.updated == {"full_name": "New Name"}
