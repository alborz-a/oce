# [RSC-IRAN] Backend region lock configuration
import os

REGION_LOCK = os.getenv("OE_REGION_LOCK", "ir").lower() in ("ir", "iran", "true", "1")
LOCKED_LANGUAGE = "fa"
LOCKED_CURRENCY = "IRR"
LOCKED_COUNTRY = "IR"
LOCKED_CALENDAR = "jalali"
LOCKED_WEEK_START = 6
