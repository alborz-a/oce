"""Guide overrides module manifest."""

from app.core.module_loader import ModuleManifest

manifest = ModuleManifest(
    name="oe_guide_overrides",
    version="0.1.0",
    display_name="Guide overrides",
    description="Per module, per role or per user visibility and text of the How it works guides.",
    author="RSC",
    category="core",
    depends=[],
    auto_install=True,
    enabled=True,
)
