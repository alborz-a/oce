# [RSC-IRAN] Module manifest for oe_iran_pack
from app.core.module_loader import ModuleManifest

manifest = ModuleManifest(
    name="oe_iran_pack",
    version="1.0.0",
    display_name="Regional Pack - Iran (ایران)",
    display_name_i18n={
        "fa": "بسته منطقه‌ای ایران",
        "en": "Regional Pack - Iran",
    },
    description=(
        "پکیج بومی‌سازی و استانداردهای ساختمانی ایران: تقویم شمسی جلالی، "
        "واحد پولی ریال (﷼)، مالیات بر ارزش افزوده ۱۰٪، رشته‌های فهرست بها، "
        "و الگوهای گزارش‌گیری فارسی و صورت‌وضعیت."
    ),
    author="Royal Stars Engineering Team",
    category="regional",
    depends=[],
    auto_install=True,
    enabled=True,
)
