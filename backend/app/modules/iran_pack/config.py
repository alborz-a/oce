# [RSC-IRAN] Regional configuration for Iran
from typing import Any

PACK_CONFIG: dict[str, Any] = {
    # ── Identity ─────────────────────────────────────────────────────────────
    "region_code": "IR",
    "countries": ["IR"],
    "default_currency": "IRR",
    "supported_currencies": ["IRR"],
    "default_locale": "fa",
    "measurement_system": "metric",
    "paper_size": "A4",
    "date_format": "YYYY/MM/DD",
    "number_format": "1,234.56",
    # ── Calendar ─────────────────────────────────────────────────────────────
    "calendar": {
        "primary": "jalali",
        "work_week": {
            "work_days": ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"],
            "weekend_days": ["friday"],
            "week_start": 6,  # Saturday
        },
    },
    # ── Tax Rules (VAT) ──────────────────────────────────────────────────────
    "tax_rules": {
        "vat_rate": 0.10,  # 10% VAT in Iran
        "vat_name": "مالیات بر ارزش افزوده",
        "vat_name_en": "Value Added Tax (VAT)",
    },
    # ── Classification Standards (فهرست بها سازمان برنامه و بودجه) ─────────────
    "standards": [
        {
            "code": "FEHREST_BAHA",
            "name": "فهرست بهای پایه سازمان برنامه و بودجه",
            "description": "فهرست بهای پایه رشته‌های ابنیه، تاسیسات، راه و باند و خطوط انتقال",
            "disciplines": [
                {"code": "ABNIEH", "name": "ابنیه"},
                {"code": "MECH", "name": "تأسیسات مکانیکی"},
                {"code": "ELEC", "name": "تأسیسات برقی"},
                {"code": "ROAD", "name": "راه، راه‌آهن و باند فرودگاه"},
                {"code": "WATER", "name": "توزیع آب و خطوط انتقال"},
                {"code": "SEWER", "name": "شبکه جمع‌آوری و انتقال فاضلاب"},
                {"code": "DRAIN", "name": "آبیاری و زهکشی"},
                {"code": "OIL_GAS", "name": "نفت، گاز و پتروشیمی"},
            ],
        },
    ],
    # ── Contract types ───────────────────────────────────────────────────────
    "contract_types": [
        {
            "code": "PUB_4311",
            "name": "شرایط عمومی پیمان (نشریه ۴۳۱۱)",
            "description": "پیمان استاندارد طرح و ساخت / قیمت فهرست بها",
        },
        {
            "code": "LUMP_SUM",
            "name": "قرارداد مقطوع / سرجمع",
            "description": "قرارداد با مبلغ کل قطعی بدون تعدیل آحاد بها",
        },
        {
            "code": "MC",
            "name": "پیمان مدیریت (مدیریت طرح - MC)",
            "description": "قرارداد حق‌الزحمه مدیریت با درصد مشخص",
        },
    ],
    # ── Report Templates ─────────────────────────────────────────────────────
    "report_templates": [
        {"code": "SOORAT_VAZIYAT", "name": "صورت‌وضعیت کارکرد موقت / قطعی"},
        {"code": "BARAVORD_MALI", "name": "برآورد مالی و آنالیز بها"},
        {"code": "METRE_KHOLESE", "name": "خلاصه متره و برآورد احجام"},
    ],
}
