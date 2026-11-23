"""Correspondence attachment allowlist: common office/text/image/CAD types accepted; executables, HTML, SVG, JS refused."""

from __future__ import annotations

import pytest

from app.modules.correspondence.router import ALLOWED_ATTACHMENT_TYPES, _is_plain_text_attachment

ZIP_HEAD = b"PK\x03\x04" + b"\x00" * 26
OLE_HEAD = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 24
PNG_HEAD = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
PDF_HEAD = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"


@pytest.mark.parametrize(
    "token",
    ["pdf", "png", "jpeg", "gif", "webp", "zip", "ole", "dwg", "dxf"],
)
def test_allowlist_contains_office_image_cad_tokens(token):
    assert token in ALLOWED_ATTACHMENT_TYPES


def test_allowlist_still_excludes_active_content_tokens():
    for token in ("xml", "html", "svg", "exe", "elf", "shellscript", "js"):
        assert token not in ALLOWED_ATTACHMENT_TYPES


def test_txt_utf8_accepted_as_plain_text():
    body = "گزارش هفتگی\nخط دوم".encode()
    assert _is_plain_text_attachment(body, "گزارش-هفتگی.txt") is True


def test_csv_accepted_as_plain_text():
    assert _is_plain_text_attachment(b"a,b\n1,2\n", "data.csv") is True


@pytest.mark.parametrize(
    "body, name",
    [
        (b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 40, "setup.exe"),  # binary body, wrong extension
        (b"<html><script>alert(1)</script></html>", "page.txt"),  # markup in a text name
        (b"<svg onload=alert(1)/>", "pic.txt"),
        (b"alert(1)\n", "script.js"),
        (b"<html></html>", "page.html"),
        (b"text\x00with nul", "notes.txt"),
        (b"\xff\xfe\x00bad", "bin.txt"),  # not valid UTF-8 without BOM
    ],
)
def test_executables_html_svg_js_rejected_as_plain_text(body, name):
    assert _is_plain_text_attachment(body, name) is False


def test_pdf_body_under_txt_name_is_not_plain_text():
    # Real signature present: handled by the magic-byte gate, not the plain-text path.
    assert _is_plain_text_attachment(PDF_HEAD, "fake.txt") is False


def test_signature_heads_are_recognised_for_gate():
    from app.core.file_signature import detect

    assert detect(ZIP_HEAD) == "zip"
    assert detect(OLE_HEAD) == "ole"
    assert detect(PNG_HEAD) == "png"
    assert detect(PDF_HEAD) == "pdf"
