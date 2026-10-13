# [RSC-IRAN] Jalali (شمسی) calendar utilities for Backend reports, PDFs and emails
from __future__ import annotations

import datetime
from typing import Tuple

PERSIAN_MONTH_NAMES = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
]

PERSIAN_WEEKDAY_NAMES = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنج‌شنبه",
    "جمعه",
]

PERSIAN_DIGITS_MAP = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
ARABIC_DIGITS_MAP = str.maketrans("٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹")


def to_persian_digits(value: str | int | float) -> str:
    """Convert latin or arabic digits to Persian digits (۰-۹)."""
    return str(value).translate(PERSIAN_DIGITS_MAP).translate(ARABIC_DIGITS_MAP)


def gregorian_to_jalali(gy: int, gm: int, gd: int) -> Tuple[int, int, int]:
    """Convert Gregorian (year, month 1-12, day 1-31) to Jalali (jy, jm, jd)."""
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    jy = 0 if gy <= 1600 else 979
    g = gy - (621 if gy <= 1600 else 1600)
    gy2 = g + 1 if gm > 2 else g
    days = (
        365 * g
        + (gy2 + 3) // 4
        - (gy2 + 99) // 100
        + (gy2 + 399) // 400
        - 80
        + gd
        + g_d_m[gm - 1]
    )
    jy += 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    jm = 1 + (days // 31) if days < 186 else 7 + ((days - 186) // 30)
    jd = 1 + (days % 31 if days < 186 else (days - 186) % 30)
    return jy, jm, jd


def jalali_to_gregorian(jy: int, jm: int, jd: int) -> Tuple[int, int, int]:
    """Convert Jalali (jy, jm, jd) to Gregorian (gy, gm, gd)."""
    j = jy - (0 if jy <= 979 else 979)
    gy = 621 if jy <= 979 else 1600
    days = (
        365 * j
        + (j // 33) * 8
        + ((j % 33) + 3) // 4
        + 78
        + jd
        + ((jm - 1) * 31 if jm < 7 else (jm - 7) * 30 + 186)
    )
    gy += 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1
    is_leap = (gy % 4 == 0 and gy % 100 != 0) or (gy % 400 == 0)
    sal_a = [0, 31, 29 if is_leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 0
    for idx in range(1, 13):
        v = sal_a[idx]
        if gd <= v:
            gm = idx
            break
        gd -= v
    return gy, gm, gd


def format_jalali(dt: datetime.date | datetime.datetime | str, style: str = "short") -> str:
    """Format date to Jalali string:
    - 'short': ۱۴۰۵/۰۷/۱۹
    - 'long': ۱۹ مهر ۱۴۰۵
    """
    if isinstance(dt, str):
        try:
            # Handle YYYY-MM-DD or full ISO
            clean_str = dt.split("T")[0]
            parts = clean_str.split("-")
            gy, gm, gd = int(parts[0]), int(parts[1]), int(parts[2])
        except Exception:
            return dt
    elif isinstance(dt, (datetime.date, datetime.datetime)):
        gy, gm, gd = dt.year, dt.month, dt.day
    else:
        return str(dt)

    jy, jm, jd = gregorian_to_jalali(gy, gm, gd)

    if style == "long":
        m_name = PERSIAN_MONTH_NAMES[jm - 1] if 1 <= jm <= 12 else ""
        return f"{to_persian_digits(jd)} {m_name} {to_persian_digits(jy)}"

    return f"{to_persian_digits(jy)}/{to_persian_digits(f'{jm:02d}')}/{to_persian_digits(f'{jd:02d}')}"
