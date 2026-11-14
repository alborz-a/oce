"""The service worker and its loader must be revalidated, or a deploy never reaches returning visitors."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import cli_static


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>app</title>", encoding="utf-8")
    (dist / "sw.js").write_text("self.skipWaiting();\n", encoding="utf-8")
    (dist / "registerSW.js").write_text("// register\n", encoding="utf-8")
    (dist / "workbox-abc123.js").write_text("// wb\n", encoding="utf-8")
    (dist / "robots.txt").write_text("User-agent: *\n", encoding="utf-8")
    monkeypatch.setattr(cli_static, "get_frontend_dir", lambda: dist)
    app = FastAPI()
    cli_static.mount_frontend(app)
    return TestClient(app)


@pytest.mark.parametrize("path", ["/sw.js", "/registerSW.js", "/workbox-abc123.js"])
def test_worker_files_answer_no_cache(client: TestClient, path: str) -> None:
    r = client.get(path)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-cache"


def test_other_root_files_keep_default_caching(client: TestClient) -> None:
    """Control: the header is not blanket-applied."""
    r = client.get("/robots.txt")
    assert r.status_code == 200
    assert r.headers.get("cache-control") != "no-cache"
