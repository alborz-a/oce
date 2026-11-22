"""Dashboard cards: picture_url (presigned) and colour per card."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import app.modules.projects.picture as picture_mod
import app.modules.projects.router as router_mod
from app.modules.projects.schemas import ProjectCardMetrics


def _backend_mock(url: str | None) -> MagicMock:
    backend = MagicMock()
    backend.url_for = MagicMock(return_value=url)
    backend.put = AsyncMock()
    backend.delete = AsyncMock()
    return backend


def _project(**overrides) -> SimpleNamespace:
    base = {"picture_key": None, "custom_fields": None}
    base.update(overrides)
    return SimpleNamespace(**base)


def test_card_picture_url_presigned_when_key_set() -> None:
    backend = _backend_mock("https://s3.example/presigned")
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        url, _ = router_mod._card_picture_and_color(_project(picture_key="projects/x/picture.png"))
    assert url == "https://s3.example/presigned"
    assert backend.url_for.call_args.args[0] == "projects/x/picture.png"


def test_card_picture_url_none_without_key() -> None:
    backend = _backend_mock("https://s3.example/presigned")
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        url, _ = router_mod._card_picture_and_color(_project())
    assert url is None
    backend.url_for.assert_not_called()


def test_card_picture_url_none_on_local_backend() -> None:
    backend = _backend_mock(None)
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        url, _ = router_mod._card_picture_and_color(_project(picture_key="projects/x/picture.jpg"))
    assert url is None


def test_card_color_from_mizito_custom_fields() -> None:
    backend = _backend_mock(None)
    with patch.object(picture_mod, "get_storage_backend", return_value=backend):
        _, color = router_mod._card_picture_and_color(_project(custom_fields={"mizito": {"color": "red-dark"}}))
        _, none_color = router_mod._card_picture_and_color(_project(custom_fields={"other": 1}))
        _, bad_color = router_mod._card_picture_and_color(_project(custom_fields={"mizito": {"color": 5}}))
    assert color == "red-dark"
    assert none_color is None
    assert bad_color is None


def test_card_metrics_schema_carries_picture_and_color() -> None:
    card = ProjectCardMetrics(id=str(uuid.uuid4()), name="P", picture_url="https://s3.example/p", color="green")
    dumped = card.model_dump()
    assert dumped["picture_url"] == "https://s3.example/p"
    assert dumped["color"] == "green"


def test_card_metrics_schema_defaults_none() -> None:
    dumped = ProjectCardMetrics(id=str(uuid.uuid4()), name="P").model_dump()
    assert dumped["picture_url"] is None
    assert dumped["color"] is None
