# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Team chat module manifest."""

from app.core.module_loader import ModuleManifest

manifest = ModuleManifest(
    name="oe_team_chat",
    version="0.1.0",
    display_name="Team Chat",
    description="Company, project, group and direct chat rooms with live WebSocket updates",
    author="RSC fork",
    category="core",
    depends=["oe_users", "oe_projects"],
    auto_install=True,
    enabled=True,
)
