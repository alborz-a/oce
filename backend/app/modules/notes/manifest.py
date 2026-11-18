# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Personal notes module manifest."""

from app.core.module_loader import ModuleManifest

manifest = ModuleManifest(
    name="oe_notes",
    version="0.1.0",
    display_name="Personal Notes",
    description="Per-user personal notes (title, body, colour, pin). Strictly owner-scoped.",
    author="RSC fork",
    category="core",
    depends=["oe_users"],
    auto_install=True,
    enabled=True,
)
