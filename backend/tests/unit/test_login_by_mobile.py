"""Login by mobile + password: normalisation and ambiguous-number handling."""

from types import SimpleNamespace

import pytest

from app.core.mobile import normalize_mobile
from app.modules.users.service import UserService


@pytest.mark.parametrize(
    "raw",
    ["09123456789", "+989123456789", "989123456789", "9123456789", "00989123456789",
     "۰۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩", "0912 345 6789", "0912-345-6789", " +98 912 345 6789 "],
)
def test_normalize_ok(raw):
    assert normalize_mobile(raw) == "09123456789"


@pytest.mark.parametrize("raw", ["", None, "a.pirnia@royalstars.co", "0812345678", "0912345", "12345678901234"])
def test_normalize_rejects(raw):
    assert normalize_mobile(raw) is None


class _Repo:
    def __init__(self, by_mobile, by_email=None):
        self.by_mobile, self.by_email = by_mobile, by_email or {}

    async def get_by_mobile(self, m):
        return self.by_mobile.get(m, [])

    async def get_by_email(self, e):
        return self.by_email.get(e.lower())


def _svc(repo):
    svc = UserService.__new__(UserService)
    svc.user_repo = repo
    return svc


@pytest.mark.asyncio
async def test_unique_mobile_resolves():
    u = SimpleNamespace(id=1)
    assert await _svc(_Repo({"09123456789": [u]}))._find_login_user("+989123456789") is u


@pytest.mark.asyncio
async def test_ambiguous_mobile_resolves_nobody():
    r = _Repo({"09123456789": [SimpleNamespace(id=1), SimpleNamespace(id=2)]})
    assert await _svc(r)._find_login_user("09123456789") is None


@pytest.mark.asyncio
async def test_unknown_mobile_and_email_path():
    u = SimpleNamespace(id=3)
    svc = _svc(_Repo({}, {"a@b.co": u}))
    assert await svc._find_login_user("09120000000") is None
    assert await svc._find_login_user("A@b.co") is u
