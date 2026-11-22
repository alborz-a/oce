"""Mailbox letter body sanitizer: allowlist tags, safe links only, no script or handlers."""

from __future__ import annotations

from app.modules.correspondence.html_sanitize import plain_text_to_html, sanitize_html


def test_script_block_and_content_removed():
    out = sanitize_html("<p>hi</p><script>alert(1)</script><p>bye</p>")
    assert "script" not in out.lower()
    assert "alert" not in out
    assert out == "<p>hi</p><p>bye</p>"


def test_event_handlers_and_unknown_tags_dropped():
    out = sanitize_html('<img src=x onerror="alert(1)"><span onclick="x()">t</span>')
    assert "img" not in out
    assert "onerror" not in out and "onclick" not in out
    assert out == "<span>t</span>"


def test_javascript_and_data_hrefs_removed():
    assert sanitize_html('<a href="javascript:alert(1)">x</a>') == "<a>x</a>"
    assert sanitize_html('<a href="JaVaScRiPt:alert(1)">x</a>') == "<a>x</a>"
    assert sanitize_html('<a href=" java\tscript:alert(1)">x</a>') == "<a>x</a>"
    assert sanitize_html('<a href="data:text/html,hi">x</a>') == "<a>x</a>"


def test_safe_links_kept_with_href():
    out = sanitize_html('<a href="https://example.com/a?b=1&c=2" style="color:red">go</a>')
    assert 'href="https://example.com/a?b=1&amp;c=2"' in out
    assert "style" not in out
    assert out.endswith(">go</a>")
    assert "mailto:" in sanitize_html('<a href="mailto:a@b.co">m</a>')


def test_nested_disallowed_tags_dropped_text_kept():
    out = sanitize_html("<div><table><tr><td><b>bold</b></td></tr></table></div>")
    assert out == "<b>bold</b>"


def test_allowed_formatting_tags_kept():
    html_in = "<p><strong>a</strong> <em>b</em> <u>c</u> <i>d</i></p><ul><li>x</li></ul><ol><li>y</li></ol><blockquote>q</blockquote>"
    assert sanitize_html(html_in) == html_in


def test_br_kept_and_text_escaped():
    assert sanitize_html("a<br/>b") == "a<br>b"
    assert sanitize_html("1 < 2 & 3") == "1 &lt; 2 &amp; 3"


def test_comments_and_cdata_dropped():
    assert sanitize_html("<!-- x --><p>ok</p>") == "<p>ok</p>"


def test_plain_text_forward_note_escaped():
    assert plain_text_to_html("<script>x</script>\nline") == "&lt;script&gt;x&lt;/script&gt;<br>line"
    assert sanitize_html(plain_text_to_html("<b>no</b>")) == "&lt;b&gt;no&lt;/b&gt;"
