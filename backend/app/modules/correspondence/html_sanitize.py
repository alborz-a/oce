# DDC-CWICR-OE: DataDrivenConstruction - OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Allowlist HTML sanitizer for mailbox letter bodies (stdlib only, no new dependency).

Allowed tags are kept, everything else is dropped. Text inside ``script`` and ``style`` is
dropped too. Only ``a[href]`` keeps an attribute, and only with an http, https or mailto scheme.
All text is re-escaped, so the output never contains a raw ``<`` from user text.
"""

from __future__ import annotations

import html
from html.parser import HTMLParser

ALLOWED_TAGS = frozenset({"p", "br", "b", "i", "u", "strong", "em", "ul", "ol", "li", "a", "blockquote", "span"})
VOID_TAGS = frozenset({"br"})
DROP_CONTENT_TAGS = frozenset({"script", "style"})
SAFE_SCHEMES = ("http://", "https://", "mailto:")


def _safe_href(value: str | None) -> str | None:
    if not value:
        return None
    # Browsers ignore control characters and whitespace inside a scheme, so strip them before the check.
    cleaned = "".join(ch for ch in value if ch.isprintable() and not ch.isspace())
    if cleaned.lower().startswith(SAFE_SCHEMES):
        return html.escape(cleaned, quote=True)
    return None


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._skip_depth = 0  # inside script/style: drop everything until the matching end tag

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in DROP_CONTENT_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth or tag not in ALLOWED_TAGS:
            return
        if tag == "a":
            href = _safe_href(dict(attrs).get("href"))
            self.out.append(f'<a href="{href}" rel="noopener noreferrer" target="_blank">' if href else "<a>")
            return
        self.out.append(f"<{tag}>")

    def handle_startendtag(self, tag: str, attrs) -> None:
        if tag in VOID_TAGS and not self._skip_depth:
            self.out.append(f"<{tag}>")
            return
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag in DROP_CONTENT_TAGS:
            if self._skip_depth:
                self._skip_depth -= 1
            return
        if self._skip_depth or tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        self.out.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self._skip_depth:
            self.out.append(html.escape(data, quote=False))

    # Comments, declarations, processing instructions and CDATA are dropped entirely.
    def handle_comment(self, data: str) -> None:
        return

    def handle_decl(self, decl: str) -> None:
        return

    def handle_pi(self, data: str) -> None:
        return

    def unknown_decl(self, data: str) -> None:
        return


def sanitize_html(value: str | None) -> str:
    """Return ``value`` reduced to the allowlist. Safe to call on already-clean input."""
    if not value:
        return ""
    parser = _Sanitizer()
    parser.feed(value)
    parser.close()
    return "".join(parser.out)


def plain_text_to_html(value: str | None) -> str:
    """Plain text (for example a forward note) as HTML: escaped, newlines become ``<br>``."""
    if not value:
        return ""
    return html.escape(value, quote=False).replace("\r\n", "\n").replace("\n", "<br>")
