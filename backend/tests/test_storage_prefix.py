"""S3 key prefix, documents on object storage, register-object and local-to-S3 migration.

Everything runs against an in-memory fake S3 client and an in-memory SQLite database: no network.
"""

from __future__ import annotations

import io
import sys
import types
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core import storage as storage_mod
from app.modules.documents import object_store
from app.modules.documents.migrate_local_to_s3 import migrate
from app.modules.documents.models import Document, ProjectPhoto

PREFIX = "oce-docs/"
PID = uuid.uuid4()


# ── fakes ────────────────────────────────────────────────────────────────


class _Body:
    def __init__(self, data: bytes):
        self._d = data
        self._pos = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def read(self, n: int = -1) -> bytes:
        if n < 0:
            n = len(self._d)
        out = self._d[self._pos : self._pos + n]
        self._pos += len(out)
        return out


class FakeS3Client:
    """Just enough of an aioboto3 S3 client; objects are keyed by the FULL bucket key."""

    def __init__(self, store: dict[str, bytes]):
        self.store = store

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def put_object(self, Bucket, Key, Body):  # noqa: N803
        self.store[Key] = bytes(Body)

    async def upload_fileobj(self, fh, Bucket, Key):  # noqa: N803
        self.store[Key] = fh.read()

    async def get_object(self, Bucket, Key):  # noqa: N803
        if Key not in self.store:
            raise KeyError("NoSuchKey")
        return {"Body": _Body(self.store[Key])}

    async def head_object(self, Bucket, Key):  # noqa: N803
        if Key not in self.store:
            raise KeyError("NoSuchKey")
        return {"ContentLength": len(self.store[Key])}

    async def delete_object(self, Bucket, Key):  # noqa: N803
        self.store.pop(Key, None)

    async def list_objects_v2(self, Bucket, Prefix, ContinuationToken=None):  # noqa: N803
        keys = sorted(k for k in self.store if k.startswith(Prefix))
        return {"Contents": [{"Key": k, "Size": len(self.store[k])} for k in keys], "IsTruncated": False}

    async def delete_objects(self, Bucket, Delete):  # noqa: N803
        for o in Delete["Objects"]:
            self.store.pop(o["Key"], None)


@pytest.fixture
def s3(monkeypatch):
    """An S3StorageBackend with prefix ``oce-docs/`` over a dict; returns (backend, store)."""
    monkeypatch.setitem(sys.modules, "aioboto3", sys.modules.get("aioboto3") or types.ModuleType("aioboto3"))
    monkeypatch.setattr(storage_mod, "_is_not_found", lambda exc: isinstance(exc, KeyError))
    store: dict[str, bytes] = {}
    be = storage_mod.S3StorageBackend(
        endpoint="http://x", access_key="a", secret_key="b", bucket="bkt", region="r", key_prefix=PREFIX
    )
    monkeypatch.setattr(be, "_client_ctx", lambda: FakeS3Client(store))
    return be, store


@pytest.fixture
def backend_singleton(monkeypatch, s3):
    be, store = s3
    monkeypatch.setattr(object_store, "get_storage_backend", lambda: be)
    monkeypatch.setattr(object_store, "s3_enabled", lambda: True)
    return be, store


# ── 1. the prefix is applied to every key ────────────────────────────────


async def test_prefix_applied_to_every_operation(s3, tmp_path):
    be, store = s3
    await be.put("projects/p/a.txt", b"hello")
    assert list(store) == [PREFIX + "projects/p/a.txt"]
    assert await be.get("projects/p/a.txt") == b"hello"
    assert await be.exists("projects/p/a.txt") and not await be.exists("projects/p/missing")
    assert await be.size("projects/p/a.txt") == 5
    src = tmp_path / "f.bin"
    src.write_bytes(b"streamed")
    await be.put_stream("projects/p/b.bin", src)
    assert PREFIX + "projects/p/b.bin" in store
    chunks = [c async for c in be.open_stream("projects/p/b.bin")]
    assert b"".join(chunks) == b"streamed"
    listed = await be.list_prefix("projects/p/")
    assert sorted(k for k, _ in listed) == ["projects/p/a.txt", "projects/p/b.bin"]  # prefix stripped
    assert await be.delete_prefix("") == 2 and store == {}  # an empty prefix stays inside oce-docs/
    assert all(k.startswith(PREFIX) for k in [PREFIX + "x"])


async def test_prefix_never_leaks_outside(s3):
    be, store = s3
    store["projects/foreign.txt"] = b"not ours"  # a key outside the prefix, like the bucket's own projects/
    assert await be.list_prefix("") == []
    assert await be.delete_prefix("") == 0 and "projects/foreign.txt" in store
    with pytest.raises(ValueError):
        await be.put("../escape", b"x")


# ── 2. object_store helpers ──────────────────────────────────────────────


def test_key_scope_rules():
    assert object_store.key_in_scope(f"projects/{PID}/other/a.pdf", PID)
    assert not object_store.key_in_scope(f"projects/{uuid.uuid4()}/other/a.pdf", PID)
    assert not object_store.key_in_scope("mizito/x.pdf", PID)
    assert not object_store.key_in_scope("backups/x", None)
    assert not object_store.key_in_scope(f"projects/{PID}/../x", PID)
    assert not object_store.key_in_scope("/projects/x", None)
    assert object_store.is_object_path("s3:projects/a") and not object_store.is_object_path("/data/a")


async def test_download_streams_exact_bytes(backend_singleton):
    be, _ = backend_singleton
    key = f"projects/{PID}/other/abc_plan.pdf"
    await be.put(key, b"%PDF-bytes" * 1000)
    resp = await object_store.stream_response("s3:" + key, "plan.pdf", "application/pdf")
    body = b"".join([c async for c in resp.body_iterator])
    assert body == b"%PDF-bytes" * 1000
    assert resp.headers["content-length"] == str(len(body))
    assert "attachment" in resp.headers["content-disposition"]
    with pytest.raises(HTTPException) as e:
        await object_store.stream_response("s3:projects/nothing", "x", None)
    assert e.value.status_code == 404


# ── 3. database-backed behaviour ─────────────────────────────────────────


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    import app.modules.projects.models  # noqa: F401  (registers the FK target tables)
    import app.modules.users.models  # noqa: F401
    import app.modules.bim_hub.models  # noqa: F401
    import app.modules.documents.service  # noqa: F401
    from app.database import Base

    # create the two tables plus whatever they reference through foreign keys
    need: dict[str, object] = {}
    todo = [t for t in Base.metadata.sorted_tables if t.name.startswith("oe_documents")]
    while todo:
        t = todo.pop()
        if t.name in need:
            continue
        need[t.name] = t
        todo += [fk.column.table for c in t.columns for fk in c.foreign_keys]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=list(need.values())))
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


@pytest.fixture
def router_mod(monkeypatch):
    from app.modules.documents import router as r

    async def _ok(*a, **k):
        return None

    monkeypatch.setattr(r, "verify_project_access", _ok)
    return r


async def test_upload_with_s3_stores_s3_path_and_downloads_same_bytes(backend_singleton, session, monkeypatch):
    from starlette.datastructures import UploadFile

    from app.modules.documents import service as svc

    be, store = backend_singleton
    content = b"%PDF-1.4 plan body " * 50
    f = UploadFile(file=io.BytesIO(content), filename="plan.pdf")
    doc = await svc.DocumentService(session).upload_document(PID, f, "drawing", "user-1")
    assert doc.file_path.startswith("s3:projects/") and f"/{PID}/drawing/" in doc.file_path
    assert any(k.startswith(PREFIX + f"projects/{PID}/drawing/") for k in store)
    resp = await object_store.stream_response(doc.file_path, doc.name, doc.mime_type)
    assert b"".join([c async for c in resp.body_iterator]) == content


async def test_register_object_refuses_missing_and_out_of_prefix(backend_singleton, session, router_mod):
    be, store = backend_singleton
    base = {"project_id": PID, "name": "a.pdf", "category": "contract"}
    with pytest.raises(HTTPException) as e:
        await router_mod.register_object(
            router_mod.RegisterObjectRequest(key=f"projects/{PID}/contract/none.pdf", **base), session, "u"
        )
    assert e.value.status_code == 404
    for bad in ("mizito/some/file.pdf", f"projects/{uuid.uuid4()}/contract/x.pdf", "backups/db.sql"):
        store[PREFIX + bad] = b"x"
        with pytest.raises(HTTPException) as e:
            await router_mod.register_object(router_mod.RegisterObjectRequest(key=bad, **base), session, "u")
        assert e.value.status_code == 400


async def test_register_object_creates_row_without_transfer_and_is_idempotent(backend_singleton, session, router_mod):
    be, store = backend_singleton
    key = f"projects/{PID}/contract/u1_contract.pdf"
    store[PREFIX + key] = b"x" * 123
    req = router_mod.RegisterObjectRequest(
        key=key, project_id=PID, name="contract.pdf", category="contract", tags=["t"], metadata={"a": 1}
    )
    r1 = await router_mod.register_object(req, session, "admin-1")
    r2 = await router_mod.register_object(req, session, "admin-1")
    assert r1.id == r2.id and r1.file_size == 123 and r1.category == "contract"
    assert list(store) == [PREFIX + key]  # nothing copied
    photo_key = f"projects/{PID}/photos/u2_p.jpg"
    store[PREFIX + photo_key] = b"jpg"
    ph = await router_mod.register_photo_object(
        router_mod.RegisterObjectRequest(key=photo_key, project_id=PID, name="p.jpg", category="site"), session, "admin-1"
    )
    assert ph.filename == "p.jpg"


async def test_migration_is_idempotent_and_keeps_local_files(backend_singleton, session, tmp_path):
    be, store = backend_singleton
    local = tmp_path / "abc123_report.pdf"
    local.write_bytes(b"local bytes")
    session.add(Document(project_id=PID, name="report.pdf", category="other", file_size=11, mime_type="",
                         file_path=str(local), uploaded_by="u"))
    photo_local = tmp_path / "pic.jpg"
    photo_local.write_bytes(b"jpegdata")
    session.add(ProjectPhoto(project_id=PID, filename="pic.jpg", file_path=str(photo_local), created_by="u"))
    session.add(Document(project_id=PID, name="pic.jpg", category="photo", file_size=8, mime_type="",
                         file_path=str(photo_local), uploaded_by="u"))
    await session.commit()

    dry = await migrate(session, be, dry_run=True)
    assert dry["migrated"] == 2 and store == {}

    s1 = await migrate(session, be)
    assert s1["migrated"] == 2 and s1["errors"] == 0
    assert sorted(s1["delete_candidates"]) == sorted([str(local), str(photo_local)])
    assert local.exists() and photo_local.exists()  # local files are never deleted
    assert len(store) == 2 and all(k.startswith(PREFIX + f"projects/{PID}/") for k in store)
    from sqlalchemy import select

    paths = [d.file_path for d in (await session.execute(select(Document))).scalars()]
    assert all(p.startswith("s3:projects/") for p in paths)
    photo_paths = [p.file_path for p in (await session.execute(select(ProjectPhoto))).scalars()]
    assert set(photo_paths) <= set(paths)  # photo and its document share one object

    s2 = await migrate(session, be)
    assert s2["migrated"] == 0 and s2["errors"] == 0 and len(store) == 2


async def test_migration_leaves_row_when_local_file_missing(backend_singleton, session, tmp_path):
    be, store = backend_singleton
    session.add(Document(project_id=PID, name="gone.pdf", category="other", file_size=1, mime_type="",
                         file_path=str(tmp_path / "gone.pdf"), uploaded_by="u"))
    await session.commit()
    s = await migrate(session, be)
    assert s["skipped_missing"] == 1 and s["migrated"] == 0 and store == {}


def test_config_has_prefix_setting():
    from app.config import Settings

    assert Settings.model_fields["s3_key_prefix"].default == ""
