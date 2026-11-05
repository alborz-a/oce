# DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
# Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
"""Global search API router.

Endpoint:
    GET /api/v1/global-search?q=...&project_id=...&limit=20

The prefix used to be /api/v1/search, but the module-loader auto-mounts
``app.modules.search`` at the same /api/v1/search prefix. Both routers
work today because their child paths don't overlap, but adding a route
in one that collides with the other would silently shadow. The prefixes
are now distinct so that class of bug can't slip past code review.
"""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Query

from app.core.global_search import global_search
from app.dependencies import CurrentUserId, SessionDep, accessible_project_ids, verify_project_access

router = APIRouter(prefix="/api/v1/global-search", tags=["Search"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[dict[str, Any]])
async def search(
    session: SessionDep,
    user_id: CurrentUserId,
    q: str = Query(default="", description="Search query string"),
    project_id: str | None = Query(default=None, description="Limit search to a specific project"),
    limit: int = Query(default=50, ge=1, le=500, description="Maximum results to return"),
) -> list[dict[str, Any]]:
    """Search across all modules - BOQ positions, contacts, documents, RFIs,
    tasks, cost items, meetings, inspections, and NCRs.

    Results are ranked by relevance score. Each result includes:
    module, type, id, title, subtitle, url, score.
    """
    if not q.strip():
        return []
    allowed: set[Any] | None = None
    if project_id:
        try:
            pid = uuid.UUID(project_id)
        except ValueError:
            return []
        await verify_project_access(pid, user_id, session)
    # Only projects the caller owns or is a member of (``None`` = admin,
    # unrestricted). A project-scoped search keeps the set so per-folder
    # document grants still apply.
    allowed = await accessible_project_ids(session, user_id, live_only=True)
    if project_id and allowed is not None:
        allowed = {pid}
    return await global_search(
        session,
        query=q,
        project_id=project_id,
        limit=limit,
        allowed_project_ids=allowed,
        user_id=user_id,
    )
