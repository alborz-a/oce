# [RSC-IRAN] Digits & number normalizer for Iran regional lock
from __future__ import annotations

import re

PERSIAN_TO_ASCII = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
ARABIC_TO_ASCII = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
ASCII_TO_PERSIAN = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def normalize_digits(value: str) -> str:
    """Convert Persian (۰-۹) and Arabic (٠-٩) digits to standard ASCII (0-9)."""
    if not isinstance(value, str):
        return str(value)
    return value.translate(PERSIAN_TO_ASCII).translate(ARABIC_TO_ASCII)


def normalize_number_string(value: str) -> str:
    """Normalize numeric strings including Persian/Arabic digits, thousand separators, and decimal marks.
    
    Converts:
    - Persian/Arabic digits to ASCII 0-9
    - Persian decimal separator (٫) or comma (,) to dot (.)
    - Persian thousand separator (٬) or spaces to removed
    """
    if not isinstance(value, str):
        return str(value)
    s = normalize_digits(value.strip())
    # Remove thousand separators (٬, ,, space)
    s = s.replace("٬", "").replace(" ", "")
    # If contains comma and dot, assume comma is thousands separator
    if "," in s and "." in s:
        s = s.replace(",", "")
    elif "," in s:
        # Single comma could be decimal separator
        s = s.replace(",", ".")
    # Persian decimal mark ٫
    s = s.replace("٫", ".")
    return s


def to_persian_digits(value: str | int | float) -> str:
    """Convert ASCII digits to Persian digits (۰-۹)."""
    return str(value).translate(ASCII_TO_PERSIAN)
