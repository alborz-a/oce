"""Info banners module manifest."""

from app.core.module_loader import ModuleManifest

manifest = ModuleManifest(
    name="oe_info_banners",
    version="0.1.0",
    display_name="Info banners",
    description="Per page switch and text of the blue help banner (admin writes, everyone reads).",
    author="RSC",
    category="core",
    depends=[],
    auto_install=True,
    enabled=True,
)
