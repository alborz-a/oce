# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
"""Team chat: company, project, group and direct rooms inside OCE.

Conventions copied from ``modules/meetings`` and ``modules/global_presence``:

* ``manifest.py`` + ``on_startup`` registers permissions; the loader imports ``models`` and mounts ``router`` at
  ``/api/v1/team-chat/`` (kebab-case of the directory name).
* Tables are ``oe_team_chat_*``; a revision under ``alembic/versions`` creates them when missing (``create_all`` also
  covers running installs).
* Live updates: an in-memory hub (:mod:`app.modules.team_chat.hub`, the ``global_presence`` pattern) and the first-frame
  JWT of :mod:`app.core.ws_auth`. OCE runs ONE uvicorn process, so an in-memory hub is consistent; the hub interface is
  narrow so a Redis/LISTEN backend can replace it if workers are ever added.
* Access: company room = every active user; project room = whoever may open the project
  (:func:`app.dependencies.verify_project_access`); group/dm = their members. There is no delete endpoint.
"""


async def on_startup() -> None:
    from app.modules.team_chat.permissions import register_team_chat_permissions

    register_team_chat_permissions()
