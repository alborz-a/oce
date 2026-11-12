from types import SimpleNamespace

from app.modules.users.router import is_restricted_mode


def _u(role="editor", meta=None):
    return SimpleNamespace(role=role, metadata_=meta)


def test_flag_on_user(monkeypatch):
    monkeypatch.delenv("OCE_RESTRICTED_PROJECT_MODE_ALL", raising=False)
    assert is_restricted_mode(_u(meta={"restricted_project_mode": True}))
    # Deny by default: unflagged editor/viewer is restricted, manager is not.
    assert is_restricted_mode(_u(meta=None))
    assert is_restricted_mode(_u(role="viewer", meta={}))
    assert is_restricted_mode(_u(meta={"restricted_project_mode": "x"}))
    assert not is_restricted_mode(_u(role="manager", meta=None))
    # Explicit opt-out wins for non-admins.
    assert not is_restricted_mode(_u(meta={"restricted_project_mode": False}))


def test_global_setting_skips_admin(monkeypatch):
    monkeypatch.setenv("OCE_RESTRICTED_PROJECT_MODE_ALL", "1")
    assert is_restricted_mode(_u())
    assert not is_restricted_mode(_u(role="admin"))
    assert not is_restricted_mode(_u(role="admin", meta={"restricted_project_mode": True}))
