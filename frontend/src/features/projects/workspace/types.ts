import type { ChatMessage } from '@/modules/team-chat/types';
import type { ProjectMember } from '@/features/projects/components/TeamStrip';
import type { RawFileChip } from './lib/rawFileTag';

export type WorkspaceTabKey = 'group' | 'tasks' | 'board' | 'calendar' | 'gantt';

export interface StreamReactionMap {
  [emoji: string]: string[];
}

export type StreamItemKind = 'chat' | 'photo' | 'document' | 'task_activity' | 'minutes';

export interface StreamQuotedEntity {
  kind: StreamItemKind;
  id: string;
  title: string;
  subtitle?: string;
  thumbUrl?: string;
}

export interface ProjectPhotoItem {
  id: string;
  project_id: string;
  document_id?: string | null;
  filename: string;
  file_path?: string;
  caption?: string | null;
  gps_lat?: number | null;
  gps_lon?: number | null;
  tags?: string[];
  taken_at?: string | null;
  category?: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  has_thumbnail?: boolean;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  download_url?: string | null;
  size_bytes?: number;
}

export interface ProjectDocumentItem {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  file_size?: number;
  size_bytes?: number;
  mime_type?: string | null;
  extension?: string | null;
  version?: number;
  uploaded_by?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  modified_at?: string | null;
  download_url?: string | null;
  preview_url?: string | null;
  thumbnail_url?: string | null;
  extra?: Record<string, unknown>;
}

export interface StreamItem {
  id: string;
  kind: StreamItemKind;
  createdAt: string;
  authorId?: string | null;
  authorName: string;
  /** Sender photo (`avatar_url` of the matching project member), null when none. */
  authorAvatarUrl?: string | null;
  isCurrentUser: boolean;
  text?: string;
  replyTo?: {
    id: string;
    authorName: string;
    text: string;
    kind?: StreamItemKind;
  } | null;
  quotedEntity?: StreamQuotedEntity | null;
  reactions?: StreamReactionMap;
  rawChatMessage?: ChatMessage;
  rawPhotos?: ProjectPhotoItem[];
  rawDocument?: ProjectDocumentItem;
  /** Unresolved `[فایل: name]` tags from chat text, rendered as file chips. */
  rawFiles?: RawFileChip[];
  rawTaskActivity?: {
    taskId: string;
    taskTitle: string;
    actorName: string;
    actionText: string;
    reportText?: string;
    commentId?: string;
    isReport?: boolean;
    replyCount?: number;
  };
  rawMeeting?: {
    meetingId: string;
    title: string;
    date?: string;
    attendees?: string[];
    pdfUrl?: string;
  };
}

export interface StreamFilterState {
  search: string;
  senderId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  kind: 'all' | 'tasks' | 'minutes' | 'documents' | 'photos' | 'videos' | 'polls';
}

export interface ProjectTaskChecklistItem {
  id?: string | null;
  text?: string;
  title?: string;
  done?: boolean;
  completed?: boolean;
}

export interface ProjectTaskItem {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  task_type?: string | null;
  status: string;
  priority?: string | null;
  /** Optional because backend TaskResponse emits `checklist_progress` rather than `progress`. */
  progress?: number | null;
  checklist_progress?: number | null;
  weight?: number | null;
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  responsible_id?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  persons_involved?: string[];
  document_ids?: string[];
  checklist?: ProjectTaskChecklistItem[];
  milestone_id?: string | null;
  meeting_id?: string | null;
  result?: string | null;
  is_private?: boolean;
  created_by?: string | null;
  depends_on?: string | null;
  bim_element_ids?: string[];
  is_overdue?: boolean;
  blocked_by_count?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface StatusBreakdown {
  donePct: number;
  inProgressPct: number;
  delayedPct: number;
  remainingPct: number;
  doneCount: number;
  inProgressCount: number;
  delayedCount: number;
  remainingCount: number;
  totalWeight: number;
}

export interface BoardProgressRow {
  key: string;
  label: string;
  donePct: number;
  remainingPct: number;
  delayedPct: number;
  inProgressPct: number;
  totalCount: number;
  doneCount: number;
}

export interface ProjectSummaryStats {
  totalWeight: number;
  remainingCount: number;
  overall: StatusBreakdown;
  mine: StatusBreakdown;
  others: StatusBreakdown;
  boards: BoardProgressRow[];
}

export type WorkspaceMember = ProjectMember;

export type ProjectSwitcherCategory = 'pinned' | 'active' | 'admin_general' | 'archived';

export const DEFAULT_STREAM_FILTERS: StreamFilterState = {
  search: '',
  senderId: null,
  dateFrom: null,
  dateTo: null,
  kind: 'all',
};
