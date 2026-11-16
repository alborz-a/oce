"""Backfill Mizito topic conversation comments into ``oe_team_chat_message``.

    python -m scripts.backfill_mizito_topic_chat --dry-run
    python -m scripts.backfill_mizito_topic_chat --project-id <uuid>
    python -m scripts.backfill_mizito_topic_chat --limit 500
    python -m scripts.backfill_mizito_topic_chat

Finds tasks with ``task_type == "topic"`` (or ``metadata_["is_project_conversation"] is True``),
fetches their ``oe_collaboration_comment`` rows in chronological order, resolves or creates each
project's ``ChatRoom(kind="project")``, and inserts ``ChatMessage`` rows idempotently keyed by
``source_id = f"mizito-comment:{comment.id}"``. Running the script twice produces 0 duplicates.

Exit codes:

    0  completed cleanly
    1  invalid arguments or runtime error
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if TYPE_CHECKING:
    from app.modules.collaboration.models import Comment
    from app.modules.tasks.models import Task
    from app.modules.team_chat.models import ChatRoom

SOURCE_PREFIX = "mizito-comment:"


@dataclass
class BackfillStats:
    tasks_matched: int = 0
    comments_scanned: int = 0
    rooms_created: int = 0
    rooms_existing: int = 0
    messages_created: int = 0
    messages_skipped: int = 0


def _is_topic_task(task: Task) -> bool:
    meta = task.metadata_ if isinstance(task.metadata_, dict) else {}
    return task.task_type == "topic" or meta.get("is_project_conversation") is True


def _extract_document_ids(comment: Comment, task: Task, *, single_comment_task: bool = False) -> list[str]:
    """Collect valid linked document UUID strings from comment or task metadata."""
    candidates: list[Any] = []
    c_meta = comment.metadata_ if isinstance(comment.metadata_, dict) else {}
    t_meta = task.metadata_ if isinstance(task.metadata_, dict) else {}

    for key in ("document_ids", "documents"):
        val = c_meta.get(key)
        if isinstance(val, list):
            candidates.extend(val)
    if c_meta.get("document_id"):
        candidates.append(c_meta["document_id"])

    # Support task-level per-comment attachment maps if present.
    for map_key in ("document_ids_by_comment", "comment_document_ids", "comment_documents"):
        by_comment = t_meta.get(map_key)
        if isinstance(by_comment, dict):
            mapped = by_comment.get(str(comment.id))
            if isinstance(mapped, list):
                candidates.extend(mapped)
            elif mapped:
                candidates.append(mapped)

    if not candidates and single_comment_task:
        task_docs = t_meta.get("document_ids")
        if isinstance(task_docs, list):
            candidates.extend(task_docs)

    seen: set[str] = set()
    cleaned: list[str] = []
    for item in candidates:
        raw = item.get("document_id") or item.get("id") if isinstance(item, dict) else item
        if not raw:
            continue
        try:
            uid = str(uuid.UUID(str(raw)))
        except (ValueError, TypeError):
            continue
        if uid not in seen:
            seen.add(uid)
            cleaned.append(uid)
    return cleaned


async def _load_user_names(session: AsyncSession, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not user_ids:
        return {}
    from app.modules.users.models import User  # noqa: PLC0415

    rows = (
        await session.execute(select(User.id, User.full_name, User.email).where(User.id.in_(user_ids)))
    ).all()
    return {uid: (full_name or (email or "").split("@")[0]) for uid, full_name, email in rows}


async def _resolve_project_rooms(
    session: AsyncSession,
    project_ids: set[uuid.UUID],
    *,
    dry_run: bool,
    stats: BackfillStats,
) -> dict[uuid.UUID, ChatRoom | None]:
    if not project_ids:
        return {}
    from app.modules.projects.models import Project  # noqa: PLC0415
    from app.modules.team_chat.models import ChatRoom  # noqa: PLC0415

    existing_rooms = (
        await session.execute(select(ChatRoom).where(ChatRoom.project_id.in_(project_ids)))
    ).scalars().all()
    rooms: dict[uuid.UUID, ChatRoom | None] = {r.project_id: r for r in existing_rooms if r.project_id is not None}
    stats.rooms_existing = len(rooms)

    missing_pids = sorted(pid for pid in project_ids if pid not in rooms)
    if not missing_pids:
        return rooms

    if dry_run:
        stats.rooms_created = len(missing_pids)
        for pid in missing_pids:
            rooms[pid] = None
        return rooms

    project_rows = (
        await session.execute(select(Project.id, Project.name).where(Project.id.in_(missing_pids)))
    ).all()
    project_names = {pid: name for pid, name in project_rows}
    for pid in missing_pids:
        room = ChatRoom(
            kind="project",
            project_id=pid,
            name=project_names.get(pid) or "",
            created_by="",
        )
        session.add(room)
        rooms[pid] = room
        stats.rooms_created += 1
    await session.flush()
    return rooms


async def backfill_topic_chat(
    session: AsyncSession,
    *,
    project_id: uuid.UUID | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> BackfillStats:
    """Backfill Mizito topic task comments into ``oe_team_chat_message``.

    Flushes changes on ``session`` without committing so callers manage the transaction.
    """
    from app.modules.collaboration.models import Comment  # noqa: PLC0415
    from app.modules.tasks.models import Task  # noqa: PLC0415
    from app.modules.team_chat.models import ChatMessage  # noqa: PLC0415

    stats = BackfillStats()
    task_stmt = select(Task)
    if project_id is not None:
        task_stmt = task_stmt.where(Task.project_id == project_id)

    all_tasks = list((await session.execute(task_stmt)).scalars().all())
    topic_tasks = [t for t in all_tasks if _is_topic_task(t)]
    stats.tasks_matched = len(topic_tasks)
    if not topic_tasks:
        return stats

    task_by_id = {str(t.id): t for t in topic_tasks}
    comment_stmt = (
        select(Comment)
        .where(
            Comment.entity_type == "task",
            Comment.entity_id.in_(list(task_by_id.keys())),
            Comment.is_deleted == False,  # noqa: E712
        )
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    )
    comments = list((await session.execute(comment_stmt)).scalars().all())
    if not comments:
        return stats

    # Preload existing source_ids (including parent reply targets) in batches.
    candidate_keys: list[str] = []
    for c in comments:
        candidate_keys.append(f"{SOURCE_PREFIX}{c.id}")
        if c.parent_comment_id is not None:
            candidate_keys.append(f"{SOURCE_PREFIX}{c.parent_comment_id}")
    unique_keys = list(dict.fromkeys(candidate_keys))

    source_to_msg_id: dict[str, uuid.UUID] = {}
    for start in range(0, len(unique_keys), 500):
        chunk = unique_keys[start : start + 500]
        rows = (
            await session.execute(
                select(ChatMessage.source_id, ChatMessage.id).where(ChatMessage.source_id.in_(chunk))
            )
        ).all()
        for src, mid in rows:
            if src is not None:
                source_to_msg_id[src] = mid

    pending: list[Comment] = []
    for c in comments:
        stats.comments_scanned += 1
        src = f"{SOURCE_PREFIX}{c.id}"
        if src in source_to_msg_id:
            stats.messages_skipped += 1
            continue
        pending.append(c)
        if limit is not None and len(pending) >= limit:
            break

    if not pending:
        return stats

    needed_projects = {task_by_id[c.entity_id].project_id for c in pending}
    rooms = await _resolve_project_rooms(session, needed_projects, dry_run=dry_run, stats=stats)

    if dry_run:
        stats.messages_created = len(pending)
        return stats

    task_comment_counts: dict[str, int] = {}
    for c in comments:
        task_comment_counts[c.entity_id] = task_comment_counts.get(c.entity_id, 0) + 1

    author_names = await _load_user_names(session, {c.author_id for c in pending if c.author_id is not None})
    for c in pending:
        task = task_by_id[c.entity_id]
        room = rooms.get(task.project_id)
        if room is None:
            continue

        src = f"{SOURCE_PREFIX}{c.id}"
        reply_to_id = (
            source_to_msg_id.get(f"{SOURCE_PREFIX}{c.parent_comment_id}")
            if c.parent_comment_id is not None
            else None
        )
        c_meta = dict(c.metadata_) if isinstance(c.metadata_, dict) else {}
        author_name = str(c_meta.get("author_name") or author_names.get(c.author_id) or "")
        if author_name:
            c_meta["author_name"] = author_name
        c_meta.setdefault("source", "mizito-topic-backfill")
        c_meta["mizito_comment_id"] = str(c.id)
        c_meta["mizito_task_id"] = str(task.id)

        msg = ChatMessage(
            room_id=room.id,
            author_id=c.author_id,
            text=c.text,
            reply_to_id=reply_to_id,
            document_ids=_extract_document_ids(
                c,
                task,
                single_comment_task=(task_comment_counts.get(c.entity_id, 0) == 1),
            ),
            edited_at=c.edited_at,
            source_id=src,
            metadata_=c_meta,
            created_at=c.created_at,
        )
        session.add(msg)
        await session.flush()
        source_to_msg_id[src] = msg.id
        stats.messages_created += 1

    return stats


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="backfill_mizito_topic_chat",
        description="Idempotently migrate Mizito topic comments into team_chat project rooms.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count candidate topic tasks and comments without writing to the database.",
    )
    parser.add_argument(
        "--project-id",
        type=uuid.UUID,
        default=None,
        metavar="UUID",
        help="Backfill only the specified project UUID.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Insert at most N new chat messages.",
    )
    args = parser.parse_args(argv)
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be >= 1")
    return args


async def _run(project_id: uuid.UUID | None, limit: int | None, dry_run: bool) -> int:
    from app.database import async_session_factory  # noqa: PLC0415

    async with async_session_factory() as session:
        stats = await backfill_topic_chat(
            session,
            project_id=project_id,
            limit=limit,
            dry_run=dry_run,
        )
        if not dry_run:
            await session.commit()

    mode = "dry-run" if dry_run else "applied"
    print(
        f"[{mode}] topic_tasks={stats.tasks_matched}, comments_scanned={stats.comments_scanned}, "
        f"rooms_created={stats.rooms_created}, rooms_existing={stats.rooms_existing}, "
        f"messages_created={stats.messages_created}, messages_skipped={stats.messages_skipped}"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    return asyncio.run(_run(args.project_id, args.limit, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
