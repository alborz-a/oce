import importlib.util
import pathlib

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.restricted_mode import is_path_allowed
from app.modules.info_banners.models import InfoBanner
from app.modules.info_banners.router import BannerIn, list_banners, upsert_banner


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(InfoBanner.__table__.create)
    async with async_sessionmaker(engine, expire_on_commit=False)() as s:
        yield s
    await engine.dispose()


def test_restricted_user_may_only_read_banners():
    assert is_path_allowed("GET", "/api/v1/info-banners/")
    assert is_path_allowed("GET", "/api/v1/info-banners")
    assert not is_path_allowed("PUT", "/api/v1/info-banners/tasks/")
    assert not is_path_allowed("POST", "/api/v1/info-banners/")


@pytest.mark.asyncio
async def test_default_empty_then_upsert_and_read(session):
    assert await list_banners(session, {"sub": "u"}) == {}
    out = await upsert_banner("tasks", BannerIn(visible=True, text="  متن  "), session)
    assert out.visible is True and out.text == "متن"
    await upsert_banner("tasks", BannerIn(visible=False, text=None), session)
    got = await list_banners(session, {"sub": "u"})
    assert got == {"tasks": {"visible": False, "text": None}}
    rows = (await session.execute(InfoBanner.__table__.select())).fetchall()
    assert len(rows) == 1


def test_write_route_requires_admin():
    from app.modules.info_banners.router import router

    route = next(r for r in router.routes if getattr(r, "methods", None) == {"PUT"})
    assert route.dependencies, "PUT must carry an auth dependency"
    assert not any(r.methods == {"PUT"} and not r.dependencies for r in router.routes if hasattr(r, "methods"))


def test_migration_is_rerunnable_guarded():
    p = pathlib.Path(__file__).resolve().parents[2] / "alembic/versions/v68_info_banners.py"
    spec = importlib.util.spec_from_file_location("v68", p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    assert m.down_revision == "v67_guide_overrides"
    assert "has_table" in p.read_text()
