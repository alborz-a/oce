import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '@/shared/lib/api';
import { isHiddenSystemUser } from '@/shared/lib/hiddenUsers';
import { IMPORTER_FALLBACK_NAME, displayName, isImporter, parseImporterPrefix } from '../lib/importerAuthor';
import { parseRawFileTags } from '../lib/rawFileTag';
import type { ChatMessage } from '@/modules/team-chat/types';
import type {
  ProjectDocumentItem,
  ProjectPhotoItem,
  ProjectTaskItem,
  StreamFilterState,
  StreamItem,
  StreamItemKind,
  StreamQuotedEntity,
  StreamReactionMap,
  WorkspaceMember,
} from '../types';

export type ProjectMemberSummary = Pick<WorkspaceMember, 'user_id' | 'full_name'> &
  Partial<WorkspaceMember>;

export interface UseProjectWorkspaceStreamOptions {
  projectId: string;
  currentUserId: string;
  roomMessages: ChatMessage[];
  tasks: ProjectTaskItem[];
  members: ProjectMemberSummary[];
  filter: StreamFilterState;
  /** Direct chat mode: skip project-wide sources (comments, photos, docs, meetings). */
  chatOnly?: boolean;
}

export interface StreamCommentApiItem {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  author_name?: string;
  text: string;
  comment_type?: string;
  parent_comment_id?: string | null;
  is_deleted?: boolean;
  metadata?: Record<string, unknown>;
  replies?: StreamCommentApiItem[];
  created_at: string;
}

export interface StreamTimelineApiItem {
  id: string;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  module?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  parent_entity_type?: string | null;
  parent_entity_id?: string | null;
  actor_id?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
}

export interface StreamMeetingApiItem {
  id: string;
  project_id?: string;
  title: string;
  meeting_date?: string | null;
  date?: string | null;
  attendees?: Array<string | { name?: string; full_name?: string; user_id?: string }>;
  minutes?: string | null;
  status?: string;
  document_ids?: string[];
  created_by?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown>;
}

interface RawFetchedSources {
  comments: StreamCommentApiItem[];
  timeline: StreamTimelineApiItem[];
  photos: ProjectPhotoItem[];
  documents: ProjectDocumentItem[];
  meetings: StreamMeetingApiItem[];
}

const VALID_STREAM_KINDS = new Set<StreamItemKind>([
  'chat',
  'photo',
  'document',
  'task_activity',
  'minutes',
]);

function unwrapArray<T>(raw: unknown, key: 'items' | 'entries'): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const val = (raw as Record<string, unknown>)[key];
    if (Array.isArray(val)) return val as T[];
    if (key !== 'items') {
      const itemsFallback = (raw as Record<string, unknown>)['items'];
      if (Array.isArray(itemsFallback)) return itemsFallback as T[];
    }
  }
  return [];
}

function parseReactions(raw: unknown): StreamReactionMap | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: StreamReactionMap = {};
  let hasAny = false;
  for (const [emoji, users] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(users)) continue;
    const clean = users.filter((u): u is string => typeof u === 'string' && u.length > 0);
    if (clean.length > 0) {
      out[emoji] = clean;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

function parseQuotedEntity(raw: unknown): StreamQuotedEntity | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === 'string' ? rec.id : '';
  const title = typeof rec.title === 'string' ? rec.title : '';
  if (!id || !title) return null;
  const rawKind = typeof rec.kind === 'string' ? (rec.kind as StreamItemKind) : 'chat';
  const kind: StreamItemKind = VALID_STREAM_KINDS.has(rawKind) ? rawKind : 'chat';
  return {
    kind,
    id,
    title,
    subtitle: typeof rec.subtitle === 'string' ? rec.subtitle : undefined,
    thumbUrl: typeof rec.thumbUrl === 'string' ? rec.thumbUrl : undefined,
  };
}

function enrichPhoto(photo: ProjectPhotoItem): ProjectPhotoItem {
  const thumbUrl =
    photo.thumbnail_url ??
    (photo.has_thumbnail === false
      ? `/api/v1/documents/photos/${photo.id}/file/`
      : `/api/v1/documents/photos/${photo.id}/thumb/`);
  const downloadUrl = photo.download_url ?? `/api/v1/documents/photos/${photo.id}/file/`;
  return {
    ...photo,
    thumbnail_url: thumbUrl,
    preview_url: photo.preview_url ?? downloadUrl,
    download_url: downloadUrl,
  };
}

function enrichDocument(doc: ProjectDocumentItem): ProjectDocumentItem {
  const fallbackExt = doc.name.includes('.') ? doc.name.split('.').pop() : undefined;
  return {
    ...doc,
    extension: doc.extension ?? fallbackExt,
    download_url: doc.download_url ?? `/api/v1/documents/${doc.id}/download/`,
  };
}

function docAsSyntheticPhoto(doc: ProjectDocumentItem): ProjectPhotoItem {
  const url = doc.download_url ?? `/api/v1/documents/${doc.id}/download/`;
  return {
    id: doc.id,
    project_id: doc.project_id ?? '',
    document_id: doc.id,
    filename: doc.name,
    caption: doc.description || null,
    tags: [],
    created_by: doc.uploaded_by ?? '',
    created_at: doc.created_at ?? '',
    has_thumbnail: false,
    thumbnail_url: url,
    preview_url: url,
    download_url: url,
  };
}

function getReplySnippetText(item: StreamItem): string {
  if (item.text?.trim()) return item.text.trim();
  if (item.rawTaskActivity?.taskTitle) return item.rawTaskActivity.taskTitle;
  if (item.rawMeeting?.title) return item.rawMeeting.title;
  if (item.rawDocument?.name) return item.rawDocument.name;
  if (item.rawPhotos && item.rawPhotos.length > 0) return 'تصویر';
  return '';
}

function formatActionText(
  action?: string | null,
  fromStatus?: string | null,
  toStatus?: string | null,
): string {
  const norm = (action ?? '').trim().toLowerCase();
  const nextStatus = (toStatus ?? '').trim().toLowerCase();
  if (nextStatus === 'done' || nextStatus === 'completed' || norm === 'completed') {
    return 'را تکمیل کرد';
  }
  if (norm === 'created' || norm === 'create') return 'را ایجاد کرد';
  if (norm === 'deleted' || norm === 'delete') return 'را حذف کرد';
  if (fromStatus || toStatus || norm.includes('status')) return 'را تغییر وضعیت داد';
  return 'را تغییر داد';
}

function normalizeAttendees(
  raw: StreamMeetingApiItem['attendees'],
  memberNameById: Map<string, string>,
): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (entry.trim()) names.push(entry.trim());
    } else if (entry && typeof entry === 'object') {
      const label =
        entry.name?.trim() ||
        entry.full_name?.trim() ||
        (entry.user_id ? memberNameById.get(String(entry.user_id)) : undefined) ||
        '';
      if (label) names.push(label);
    }
  }
  return names;
}

function resolveItemDateKey(iso: string): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return iso.trim();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Replace the hidden importer name ("Mizito Importer") or an empty name with the
 * real reporter name from the text header, and strip that header from the body.
 * Only when the header matches; any other name is returned unchanged.
 */
export function resolveReporter(
  resolvedName: string,
  text: string,
  fallbackName = 'همکار',
): { name: string; body: string } {
  const trimmed = resolvedName.trim();
  const hidden = !trimmed || isHiddenSystemUser({ full_name: trimmed });
  if (!hidden) return { name: resolvedName, body: text };
  const { senderName, rest } = parseImporterPrefix(text);
  if (senderName === null) return { name: fallbackName, body: text };
  return { name: senderName, body: rest };
}

export function isVideoStreamItem(item: StreamItem): boolean {
  const chatMeta = item.rawChatMessage?.metadata;
  if (chatMeta) {
    if (
      chatMeta.kind === 'video' ||
      chatMeta.message_kind === 'video' ||
      chatMeta.is_video_call === true ||
      chatMeta.video_call != null ||
      typeof chatMeta.meeting_link === 'string'
    ) {
      return true;
    }
  }
  if (item.kind === 'document') {
    const mime = (item.rawDocument?.mime_type ?? '').toLowerCase();
    const ext = (item.rawDocument?.extension ?? '').toLowerCase();
    if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
      return true;
    }
  }
  return false;
}

export function isPollStreamItem(item: StreamItem): boolean {
  const chatMeta = item.rawChatMessage?.metadata;
  if (!chatMeta) return false;
  return Boolean(
    chatMeta.kind === 'poll' ||
      chatMeta.message_kind === 'poll' ||
      chatMeta.poll != null ||
      chatMeta.special_status != null,
  );
}

export function computeReplyCounts(items: readonly StreamItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const replyId = item.replyTo?.id;
    if (replyId) {
      counts[replyId] = (counts[replyId] ?? 0) + 1;
    }
    const quotedId = item.quotedEntity?.id;
    if (quotedId && quotedId !== replyId) {
      counts[quotedId] = (counts[quotedId] ?? 0) + 1;
    }
  }
  return counts;
}

export interface BuildStreamItemsInput {
  currentUserId: string;
  roomMessages: ChatMessage[];
  tasks: ProjectTaskItem[];
  members: ProjectMemberSummary[];
  sources: RawFetchedSources;
}

export function buildStreamItems({
  currentUserId,
  roomMessages,
  tasks,
  members,
  sources,
}: BuildStreamItemsInput): {
  allItems: StreamItem[];
  replyCountsByItemId: Record<string, number>;
} {
  const memberNameById = new Map<string, string>();
  for (const m of members) {
    // Importer is never shown by name; its rows fall back to the «name» prefix.
    if (m.user_id && !isImporter(m.user_id)) {
      memberNameById.set(String(m.user_id), m.full_name || m.email || 'کاربر');
    }
  }
  // Sender photos come from the members list already loaded for the project (no per-message request).
  // Importer rows have no member id, so they match by display name.
  const avatarById = new Map<string, string>();
  const avatarByName = new Map<string, string>();
  for (const m of members) {
    const url = typeof m.avatar_url === 'string' ? m.avatar_url.trim() : '';
    if (!url) continue;
    if (m.user_id && !isImporter(m.user_id)) avatarById.set(String(m.user_id), url);
    const fullName = (m.full_name ?? '').trim();
    if (fullName && !avatarByName.has(fullName)) avatarByName.set(fullName, url);
  }
  const authorAvatarFor = (id: string | null, name: string): string | null =>
    (id && avatarById.get(id)) || avatarByName.get(name.trim()) || null;

  const taskById = new Map<string, ProjectTaskItem>();
  for (const t of tasks) {
    taskById.set(String(t.id), t);
  }

  const enrichedPhotos = sources.photos.map(enrichPhoto);
  const photoByKey = new Map<string, ProjectPhotoItem>();
  const photoDocumentIds = new Set<string>();
  for (const photo of enrichedPhotos) {
    photoByKey.set(String(photo.id), photo);
    if (photo.document_id) {
      const docKey = String(photo.document_id);
      photoByKey.set(docKey, photo);
      photoDocumentIds.add(docKey);
    }
  }

  const enrichedDocs = sources.documents.map(enrichDocument);
  const docById = new Map<string, ProjectDocumentItem>();
  for (const doc of enrichedDocs) {
    docById.set(String(doc.id), doc);
  }

  const linkedDocIds = new Set<string>();
  const linkedPhotoIds = new Set<string>();
  const backfilledCommentIds = new Set<string>();
  const items: StreamItem[] = [];

  for (const msg of roomMessages) {
    const sourceId = typeof msg.metadata?.source_id === 'string' ? msg.metadata.source_id : '';
    if (sourceId.startsWith('mizito-comment:')) {
      backfilledCommentIds.add(sourceId.slice('mizito-comment:'.length));
    }

    const authorId = msg.author_id ? String(msg.author_id) : null;
    const metaAuthor = typeof msg.metadata?.author_name === 'string' ? msg.metadata.author_name : '';
    const reporter = resolveReporter(
      msg.author_name?.trim() ||
        (authorId ? memberNameById.get(authorId) : undefined) ||
        metaAuthor.trim() ||
        '',
      msg.text,
      isImporter(authorId) ? IMPORTER_FALLBACK_NAME : 'کاربر',
    );
    const authorName = reporter.name;
    // Unresolved raw `[فایل: …]` tags are stripped from the text; chat rows get them as chips below.
    const rawFileParse = parseRawFileTags(reporter.body);
    const msgBody = rawFileParse.text;
    const isCurrentUser = Boolean(currentUserId && authorId === currentUserId);
    const reactions = parseReactions(msg.metadata?.reactions);
    const quotedEntity = parseQuotedEntity(msg.metadata?.quoted_entity);

    const attachedPhotos: ProjectPhotoItem[] = [];
    const seenAttachedPhotoIds = new Set<string>();
    const attachedDocs: ProjectDocumentItem[] = [];

    for (const rawId of msg.document_ids ?? []) {
      const id = String(rawId);
      linkedDocIds.add(id);

      const photo = photoByKey.get(id);
      if (photo) {
        linkedPhotoIds.add(String(photo.id));
        if (photo.document_id) linkedPhotoIds.add(String(photo.document_id));
        if (!seenAttachedPhotoIds.has(String(photo.id))) {
          seenAttachedPhotoIds.add(String(photo.id));
          attachedPhotos.push(photo);
        }
        continue;
      }

      const doc = docById.get(id);
      if (doc) {
        if ((doc.mime_type ?? '').toLowerCase().startsWith('image/')) {
          attachedPhotos.push(docAsSyntheticPhoto(doc));
        } else {
          attachedDocs.push(doc);
        }
      }
    }

    if (attachedPhotos.length > 0 && attachedDocs.length === 0) {
      items.push({
        id: msg.id,
        kind: 'photo',
        createdAt: msg.created_at,
        authorId,
        authorName,
        isCurrentUser,
        text: msgBody,
        quotedEntity,
        reactions,
        rawChatMessage: msg,
        rawPhotos: attachedPhotos,
      });
      continue;
    }

    if (attachedDocs.length > 0) {
      attachedDocs.forEach((doc, idx) => {
        items.push({
          id: idx === 0 ? msg.id : `${msg.id}:doc:${doc.id}`,
          kind: 'document',
          createdAt: msg.created_at,
          authorId,
          authorName,
          isCurrentUser,
          text: msgBody,
          quotedEntity: idx === 0 ? quotedEntity : undefined,
          reactions: idx === 0 ? reactions : undefined,
          rawChatMessage: msg,
          rawDocument: doc,
        });
      });
      if (attachedPhotos.length > 0) {
        items.push({
          id: `${msg.id}:photos`,
          kind: 'photo',
          createdAt: msg.created_at,
          authorId,
          authorName,
          isCurrentUser,
          text: msgBody,
          rawChatMessage: msg,
          rawPhotos: attachedPhotos,
        });
      }
      continue;
    }

    items.push({
      id: msg.id,
      kind: 'chat',
      createdAt: msg.created_at,
      authorId,
      authorName,
      authorAvatarUrl: authorAvatarFor(authorId, authorName),
      isCurrentUser,
      text: msgBody,
      quotedEntity,
      reactions,
      rawChatMessage: msg,
      rawFiles: rawFileParse.files.length > 0 ? rawFileParse.files : undefined,
    });
  }

  // Standalone photos (excluding any linked to room messages), grouped by `album:*` tag.
  const albumGroups = new Map<string, ProjectPhotoItem[]>();
  for (const photo of enrichedPhotos) {
    const pid = String(photo.id);
    const pDocId = photo.document_id ? String(photo.document_id) : '';
    if (linkedPhotoIds.has(pid) || linkedDocIds.has(pid) || (pDocId && (linkedPhotoIds.has(pDocId) || linkedDocIds.has(pDocId)))) {
      continue;
    }
    const albumTag = (photo.tags ?? []).find((t) => t.startsWith('album:') && t.length > 6);
    if (albumTag) {
      const bucket = albumGroups.get(albumTag) ?? [];
      bucket.push(photo);
      albumGroups.set(albumTag, bucket);
    } else {
      const authorId = photo.created_by ? String(photo.created_by) : null;
      items.push({
        id: `photo:${pid}`,
        kind: 'photo',
        createdAt: photo.taken_at || photo.created_at,
        authorId,
        authorName: (authorId && memberNameById.get(authorId)) || 'کاربر',
        isCurrentUser: Boolean(currentUserId && authorId === currentUserId),
        text: photo.caption ?? '',
        rawPhotos: [photo],
      });
    }
  }

  for (const [albumTag, photos] of albumGroups.entries()) {
    const sorted = [...photos].sort((a, b) =>
      (a.taken_at || a.created_at).localeCompare(b.taken_at || b.created_at),
    );
    const first = sorted[0];
    if (!first) continue;
    const authorId = first.created_by ? String(first.created_by) : null;
    const caption = sorted.find((p) => Boolean(p.caption?.trim()))?.caption?.trim() ?? '';
    items.push({
      id: `album:${albumTag.slice('album:'.length)}`,
      kind: 'photo',
      createdAt: first.taken_at || first.created_at,
      authorId,
      authorName: (authorId && memberNameById.get(authorId)) || 'کاربر',
      isCurrentUser: Boolean(currentUserId && authorId === currentUserId),
      text: caption,
      rawPhotos: sorted,
    });
  }

  // Standalone documents not linked to room messages and not duplicating photo rows.
  for (const doc of enrichedDocs) {
    const did = String(doc.id);
    if (linkedDocIds.has(did) || photoDocumentIds.has(did)) continue;
    const authorId = doc.uploaded_by ? String(doc.uploaded_by) : null;
    items.push({
      id: `doc:${did}`,
      kind: 'document',
      createdAt: doc.created_at ?? '',
      authorId,
      authorName: (authorId && memberNameById.get(authorId)) || 'کاربر',
      isCurrentUser: Boolean(currentUserId && authorId === currentUserId),
      text: doc.description?.trim() || '',
      rawDocument: doc,
    });
  }

  // Task comments -> task_activity report cards.
  const seenCommentIds = new Set<string>();
  const flatComments: StreamCommentApiItem[] = [];
  for (const comment of sources.comments) {
    const queue = [comment, ...(comment.replies ?? [])];
    for (const c of queue) {
      const cid = String(c.id);
      if (seenCommentIds.has(cid) || c.is_deleted || backfilledCommentIds.has(cid)) continue;
      seenCommentIds.add(cid);
      flatComments.push(c);
    }
  }

  for (const c of flatComments) {
    const taskId = String(c.entity_id);
    const task = taskById.get(taskId);
    const metaTitle = typeof c.metadata?.task_title === 'string' ? c.metadata.task_title : '';
    const taskTitle = task?.title || metaTitle || 'وظیفه';
    const authorId = c.author_id ? String(c.author_id) : null;
    const reporter = resolveReporter(
      c.author_name?.trim() ||
        (authorId ? memberNameById.get(authorId) : undefined) ||
        '',
      c.text,
      isImporter(authorId) ? IMPORTER_FALLBACK_NAME : 'همکار',
    );
    const actorName = reporter.name;
    // Placeholder «گفتگوی پروژه» topic tasks: comments are plain chat messages.
    if (task?.task_type === 'topic' || taskTitle === 'گفتگوی پروژه') {
      items.push({
        id: `comment:${c.id}`,
        kind: 'chat',
        createdAt: c.created_at,
        authorId,
        authorName: actorName,
        isCurrentUser: Boolean(currentUserId && authorId === currentUserId),
        text: reporter.body,
        reactions: parseReactions(c.metadata?.reactions),
      });
      continue;
    }
    items.push({
      id: `comment:${c.id}`,
      kind: 'task_activity',
      createdAt: c.created_at,
      authorId,
      authorName: actorName,
      isCurrentUser: Boolean(currentUserId && authorId === currentUserId),
      text: reporter.body,
      reactions: parseReactions(c.metadata?.reactions),
      rawTaskActivity: {
        taskId,
        taskTitle,
        actorName,
        actionText: 'را گزارش کرد',
        reportText: reporter.body,
        commentId: String(c.id),
        isReport: true,
      },
    });
  }

  // Project timeline + task.metadata.mizito_history -> task_activity pills.
  const seenActivitySignatures = new Set<string>();
  for (const entry of sources.timeline) {
    const isTaskEntry =
      entry.entity_type === 'task' ||
      entry.module === 'tasks' ||
      (entry.entity_id != null && taskById.has(String(entry.entity_id)));
    if (!isTaskEntry || !entry.created_at) continue;

    const taskId = String(entry.entity_id ?? '');
    const task = taskId ? taskById.get(taskId) : undefined;
    const metaTitle = typeof entry.metadata?.task_title === 'string' ? entry.metadata.task_title : '';
    const taskTitle = task?.title || metaTitle || 'وظیفه';
    const actorId = entry.actor_id ? String(entry.actor_id) : null;
    const metaActor = typeof entry.metadata?.actor_name === 'string' ? entry.metadata.actor_name : '';
    const actorName = displayName(
      metaActor.trim() ||
        (actorId ? memberNameById.get(actorId) : undefined) ||
        'همکار',
      actorId,
    );
    const actionText = formatActionText(entry.action, entry.from_status, entry.to_status);

    seenActivitySignatures.add(`${taskId}|${entry.created_at.slice(0, 16)}|${actorName}|${actionText}`);
    items.push({
      id: `timeline:${entry.id}`,
      kind: 'task_activity',
      createdAt: entry.created_at,
      authorId: actorId,
      authorName: actorName,
      isCurrentUser: Boolean(currentUserId && actorId === currentUserId),
      rawTaskActivity: {
        taskId,
        taskTitle,
        actorName,
        actionText,
        isReport: false,
      },
    });
  }

  for (const task of tasks) {
    const history = task.metadata?.mizito_history;
    if (!Array.isArray(history)) continue;
    history.forEach((rawEntry, idx) => {
      if (!rawEntry || typeof rawEntry !== 'object') return;
      const rec = rawEntry as Record<string, unknown>;
      const createdAt =
        (typeof rec.created_at === 'string' && rec.created_at) ||
        (typeof rec.timestamp === 'string' && rec.timestamp) ||
        (typeof rec.date === 'string' && rec.date) ||
        '';
      if (!createdAt) return;
      const actorId = typeof rec.actor_id === 'string' ? rec.actor_id : null;
      const actorName = displayName(
        (typeof rec.actor_name === 'string' && rec.actor_name.trim()) ||
          (typeof rec.user_name === 'string' && rec.user_name.trim()) ||
          (actorId ? memberNameById.get(actorId) : undefined) ||
          'همکار',
        actorId,
      );
      const rawAction =
        (typeof rec.action_text === 'string' && rec.action_text.trim()) ||
        (typeof rec.description === 'string' && rec.description.trim()) ||
        '';
      const actionText =
        rawAction ||
        formatActionText(
          typeof rec.action === 'string' ? rec.action : undefined,
          typeof rec.from_status === 'string' ? rec.from_status : undefined,
          typeof rec.to_status === 'string' ? rec.to_status : undefined,
        );
      const sig = `${task.id}|${createdAt.slice(0, 16)}|${actorName}|${actionText}`;
      if (seenActivitySignatures.has(sig)) return;
      seenActivitySignatures.add(sig);
      const historyId = typeof rec.id === 'string' && rec.id ? rec.id : String(idx);

      items.push({
        id: `history:${task.id}:${historyId}`,
        kind: 'task_activity',
        createdAt,
        authorId: actorId,
        authorName: actorName,
        isCurrentUser: Boolean(currentUserId && actorId === currentUserId),
        rawTaskActivity: {
          taskId: String(task.id),
          taskTitle: task.title,
          actorName,
          actionText,
          isReport: false,
        },
      });
    });
  }

  // Meetings / Minutes.
  for (const m of sources.meetings) {
    const meetingDate = m.meeting_date || m.date || '';
    const createdAt = m.created_at || (meetingDate ? `${meetingDate}T09:00:00Z` : '');
    const authorId = m.created_by ? String(m.created_by) : null;
    const authorName = (authorId && memberNameById.get(authorId)) || 'کاربر';
    items.push({
      id: `meeting:${m.id}`,
      kind: 'minutes',
      createdAt,
      authorId,
      authorName,
      isCurrentUser: Boolean(currentUserId && authorId === currentUserId),
      text: m.minutes?.trim() || m.title,
      rawMeeting: {
        meetingId: String(m.id),
        title: m.title || 'صورتجلسه پروژه',
        date: meetingDate || createdAt,
        attendees: normalizeAttendees(m.attendees, memberNameById),
        pdfUrl: `/api/v1/meetings/${m.id}/minutes/export/pdf/`,
      },
    });
  }

  // Chronological ascending sort.
  items.sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
    if (na !== nb) return na - nb;
    return a.id.localeCompare(b.id);
  });

  // Second pass: resolve replyTo across all items and aggregate reply counts.
  const itemById = new Map<string, StreamItem>();
  for (const item of items) {
    itemById.set(item.id, item);
    if (item.rawTaskActivity?.commentId) {
      itemById.set(item.rawTaskActivity.commentId, item);
    }
  }

  const commentsById = new Map<string, StreamCommentApiItem>();
  for (const c of flatComments) commentsById.set(String(c.id), c);

  for (const item of items) {
    let targetId = item.rawChatMessage?.reply_to_id ?? null;
    if (!targetId && item.rawTaskActivity?.commentId) {
      const parentCommentId = commentsById.get(item.rawTaskActivity.commentId)?.parent_comment_id;
      if (parentCommentId) targetId = `comment:${parentCommentId}`;
    }
    if (!targetId) continue;

    const target = itemById.get(String(targetId));
    if (target) {
      item.replyTo = {
        id: target.id,
        authorName: target.authorName,
        text: getReplySnippetText(target),
        kind: target.kind,
      };
    } else {
      item.replyTo = {
        id: String(targetId),
        authorName: 'پیام',
        text: '',
      };
    }
  }

  const replyCountsByItemId = computeReplyCounts(items);
  for (const item of items) {
    if (item.rawTaskActivity?.isReport) {
      item.rawTaskActivity = {
        ...item.rawTaskActivity,
        replyCount: replyCountsByItemId[item.id] ?? 0,
      };
    }
  }

  return { allItems: items, replyCountsByItemId };
}

export function filterStreamItems(
  items: readonly StreamItem[],
  filter: StreamFilterState,
): StreamItem[] {
  const searchQuery = filter.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filter.kind !== 'all') {
      switch (filter.kind) {
        case 'tasks':
          if (item.kind !== 'task_activity') return false;
          break;
        case 'minutes':
          if (item.kind !== 'minutes') return false;
          break;
        case 'documents':
          if (item.kind !== 'document') return false;
          break;
        case 'photos':
          if (item.kind !== 'photo') return false;
          break;
        case 'videos':
          if (!isVideoStreamItem(item)) return false;
          break;
        case 'polls':
          if (!isPollStreamItem(item)) return false;
          break;
      }
    }

    if (filter.senderId !== null && filter.senderId !== '') {
      if (!item.authorId || String(item.authorId) !== String(filter.senderId)) {
        return false;
      }
    }

    if (filter.dateFrom || filter.dateTo) {
      const dayKey = resolveItemDateKey(item.createdAt);
      if (!dayKey) return false;
      if (filter.dateFrom && dayKey < filter.dateFrom) return false;
      if (filter.dateTo && dayKey > filter.dateTo) return false;
    }

    if (searchQuery) {
      const haystack = [
        item.text,
        item.authorName,
        item.quotedEntity?.title,
        item.quotedEntity?.subtitle,
        item.rawTaskActivity?.taskTitle,
        item.rawTaskActivity?.reportText,
        item.rawTaskActivity?.actionText,
        item.rawDocument?.name,
        item.rawDocument?.description,
        item.rawMeeting?.title,
        ...(item.rawMeeting?.attendees ?? []),
        ...(item.rawPhotos ?? []).flatMap((p) => [p.caption, p.filename]),
      ]
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .join('\n')
        .toLowerCase();

      if (!haystack.includes(searchQuery)) return false;
    }

    return true;
  });
}

const EMPTY_SOURCES: RawFetchedSources = {
  comments: [],
  timeline: [],
  photos: [],
  documents: [],
  meetings: [],
};

export function useProjectWorkspaceStream({
  projectId,
  currentUserId,
  roomMessages,
  tasks,
  members,
  filter,
  chatOnly = false,
}: UseProjectWorkspaceStreamOptions) {
  const [sources, setSources] = useState<RawFetchedSources>(EMPTY_SOURCES);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const seq = ++requestSeqRef.current;
    if (!projectId || chatOnly) {
      if (mountedRef.current) {
        setSources(EMPTY_SOURCES);
        setLoading(false);
        setError(null);
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const encId = encodeURIComponent(projectId);
    const results = await Promise.allSettled([
      apiGet<unknown>(`/v1/collaboration/comments/?entity_type=task&project_id=${encId}&limit=500`),
      apiGet<unknown>(`/v1/timeline/projects/${encId}`),
      apiGet<unknown>(`/v1/documents/photos/?project_id=${encId}&limit=200`),
      apiGet<unknown>(`/v1/documents/?project_id=${encId}&limit=200`),
      apiGet<unknown>(`/v1/meetings/?project_id=${encId}&limit=100`),
    ]);

    if (!mountedRef.current || requestSeqRef.current !== seq) return;

    const [commentsRes, timelineRes, photosRes, docsRes, meetingsRes] = results;
    const allRejected = results.every((r) => r.status === 'rejected');

    const nextSources: RawFetchedSources = {
      comments:
        commentsRes.status === 'fulfilled'
          ? unwrapArray<StreamCommentApiItem>(commentsRes.value, 'items')
          : [],
      timeline:
        timelineRes.status === 'fulfilled'
          ? unwrapArray<StreamTimelineApiItem>(timelineRes.value, 'entries')
          : [],
      photos:
        photosRes.status === 'fulfilled'
          ? unwrapArray<ProjectPhotoItem>(photosRes.value, 'items')
          : [],
      documents:
        docsRes.status === 'fulfilled'
          ? unwrapArray<ProjectDocumentItem>(docsRes.value, 'items')
          : [],
      meetings:
        meetingsRes.status === 'fulfilled'
          ? unwrapArray<StreamMeetingApiItem>(meetingsRes.value, 'items')
          : [],
    };

    if (allRejected) {
      const firstErr = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      const reason = firstErr?.reason;
      setError(reason instanceof Error ? reason.message : 'خطا در دریافت جریان پروژه');
    } else {
      setError(null);
    }

    setSources(nextSources);
    setLoading(false);
  }, [projectId, chatOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lastMissingDocIdsRef = useRef<string>('');
  useEffect(() => {
    const knownIds = new Set<string>();
    for (const photo of sources.photos) {
      knownIds.add(String(photo.id));
      if (photo.document_id) knownIds.add(String(photo.document_id));
    }
    for (const doc of sources.documents) {
      knownIds.add(String(doc.id));
    }

    const missingIds = new Set<string>();
    for (const msg of roomMessages) {
      for (const rawId of msg.document_ids ?? []) {
        const id = String(rawId);
        if (!knownIds.has(id)) missingIds.add(id);
      }
    }
    if (missingIds.size === 0) return;

    const missingKey = [...missingIds].sort().join(',');
    if (missingKey === lastMissingDocIdsRef.current) return;
    lastMissingDocIdsRef.current = missingKey;
    void refresh();
  }, [roomMessages, sources, refresh]);

  // New task created (composer invalidation or tasks poll) -> re-fetch timeline once
  // so the audit row for the create action shows in the feed. First mount is skipped
  // because refresh() on mount already loads the timeline.
  const knownTaskIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(tasks.map((t) => String(t.id)));
    const prev = knownTaskIdsRef.current;
    knownTaskIdsRef.current = ids;
    if (!prev) return;
    let hasNewId = false;
    for (const id of ids) {
      if (!prev.has(id)) {
        hasNewId = true;
        break;
      }
    }
    if (!hasNewId) return;
    void refresh();
  }, [tasks, refresh]);

  const { allItems, replyCountsByItemId } = useMemo(
    () =>
      buildStreamItems({
        currentUserId,
        roomMessages,
        tasks,
        members,
        sources,
      }),
    [currentUserId, roomMessages, tasks, members, sources],
  );

  const items = useMemo(
    () => filterStreamItems(allItems, filter),
    [allItems, filter],
  );

  return {
    items,
    allItems,
    loading,
    error,
    replyCountsByItemId,
    refresh,
  };
}
