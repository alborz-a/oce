# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Team chat permission definitions."""

from app.core.permissions import Role, permission_registry


def register_team_chat_permissions() -> None:
    permission_registry.register_module_permissions(
        "team_chat",
        {
            "team_chat.read": Role.VIEWER,
            "team_chat.create": Role.VIEWER,  # viewers may talk too
            "team_chat.update": Role.VIEWER,  # own messages only, enforced in the service
            "team_chat.manage": Role.MANAGER,  # create group rooms for other people
            "team_chat.import": Role.ADMIN,  # bulk history import
        },
    )
