"""Iranian mobile number normalisation (login by mobile, until SMS OTP exists)."""

from __future__ import annotations

import re

_DIGIT_MAP = str.maketrans(
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)
_MOBILE_RE = re.compile(r"^09\d{9}$")


def normalize_mobile(raw: str | None) -> str | None:
    """Return ``09xxxxxxxxx`` for any common spelling of an Iranian mobile, else ``None``.

    Accepts Persian/Arabic digits, spaces, dashes, ``+98``, ``0098``, ``98`` and ``9xxxxxxxxx``.
    """
    if not raw:
        return None
    s = str(raw).translate(_DIGIT_MAP)
    s = re.sub(r"[\s\-\(\)\u200c\u200f\u200e\.]", "", s)
    if s.startswith("+"):
        s = s[1:]
    if s.startswith("0098"):
        s = s[4:]
    elif s.startswith("98") and len(s) == 12:
        s = s[2:]
    if len(s) == 10 and s.startswith("9"):
        s = "0" + s
    return s if _MOBILE_RE.match(s) else None
