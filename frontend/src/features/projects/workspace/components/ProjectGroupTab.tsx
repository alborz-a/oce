import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPhotoFileUrl, getPhotoThumbUrl } from '@/features/documents/api';
import {
  MediaLightbox,
  type MediaLightboxItem,
} from '@/features/file-manager/components/MediaLightbox';
import { useProjectWorkspaceRoom } from '../hooks/useProjectWorkspaceRoom';
import { useProjectWorkspaceStream } from '../hooks/useProjectWorkspaceStream';
import {
  isTopicConversationTask,
  mapStatusToBoardLabel,
} from '../hooks/useProjectWorkspaceStats';
import {
  DEFAULT_STREAM_FILTERS,
  type ProjectPhotoItem,
  type ProjectTaskItem,
  type StreamFilterState,
  type StreamItem,
} from '../types';
import type { ProjectMemberSummary } from './ProjectBoardTab';
import {
  ProjectStreamComposer,
  type ComposerSendPayload,
} from './ProjectStreamComposer';
import { ProjectStreamFilterBar } from './ProjectStreamFilterBar';
import { ProjectStreamList } from './ProjectStreamList';
import { TaskQuickDetailDialog } from './TaskQuickDetailDialog';

export interface ProjectGroupTabProps {
  projectId: string;
  currentUserId: string;
  currentUser?: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string | null;
  };
  tasks: ProjectTaskItem[];
  members: ProjectMemberSummary[];
  onTasksChanged?: () => void;
  /** Optional external filter state (when controlled from top bar). */
  filter?: StreamFilterState;
  onFilterChange?: (next: StreamFilterState) => void;
  showFilterBar?: boolean;
}

export function ProjectGroupTab({
  projectId,
  currentUserId,
  currentUser,
  tasks,
  members,
  onTasksChanged,
  filter: controlledFilter,
  onFilterChange,
  showFilterBar = true,
}: ProjectGroupTabProps) {
  const [localFilter, setLocalFilter] = useState<StreamFilterState>(DEFAULT_STREAM_FILTERS);
  const filter = controlledFilter ?? localFilter;
  const setFilter = onFilterChange ?? setLocalFilter;

  const [replyTo, setReplyTo] = useState<StreamItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<ProjectTaskItem | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    items: MediaLightboxItem[];
    index: number;
  } | null>(null);

  const room = useProjectWorkspaceRoom(projectId);
  const stream = useProjectWorkspaceStream({
    projectId,
    currentUserId,
    roomMessages: room.messages,
    tasks,
    members,
    filter,
  });

  // Reset reply/dialogs when switching projects
  useEffect(() => {
    setReplyTo(null);
    setSelectedTask(null);
    setLightboxState(null);
  }, [projectId]);

  // Mark room read when messages load or new messages arrive
  const roomId = room.room?.id;
  const msgCount = room.messages.length;
  useEffect(() => {
    if (!roomId) return;
    void room.markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, msgCount]);

  const boards = useMemo(() => {
    const seen = new Set<string>(['برای انجام']);
    for (const task of tasks) {
      if (isTopicConversationTask(task)) continue;
      const raw =
        typeof task.metadata?.mizito_board === 'string'
          ? task.metadata.mizito_board.trim()
          : '';
      seen.add(raw || mapStatusToBoardLabel(task.status));
    }
    return [...seen];
  }, [tasks]);

  const handleSend = useCallback(
    async (payload: ComposerSendPayload) => {
      await room.sendMessage({
        text: payload.text,
        documentIds: payload.documentIds,
        mentions: payload.mentions,
        replyToId: payload.replyToId,
        quotedEntity: payload.quotedEntity,
      });
      if (payload.documentIds && payload.documentIds.length > 0) {
        await stream.refresh();
      }
    },
    [room, stream],
  );

  const handleReact = useCallback(
    (item: StreamItem, emoji: string) => {
      if (!item.rawChatMessage) return;
      void room.toggleReaction(item.rawChatMessage.id, emoji, currentUserId);
    },
    [room, currentUserId],
  );

  const handleEdit = useCallback(
    (item: StreamItem, nextText: string) => {
      if (!item.rawChatMessage) return;
      void room.editMessage(item.rawChatMessage.id, nextText);
    },
    [room],
  );

  const isAdminRole = useAuthStore((s) => s.userRole) === 'admin';
  const handleDelete = useCallback(
    (item: StreamItem) => {
      if (!item.rawChatMessage) return;
      void room.deleteMessage(item.rawChatMessage.id);
    },
    [room],
  );

  const handleOpenTask = useCallback(
    (taskId: string) => {
      const found = tasks.find((t) => t.id === taskId);
      if (found) {
        setSelectedTask(found);
      }
    },
    [tasks],
  );

  const handleOpenPhoto = useCallback((photos: ProjectPhotoItem[], index: number) => {
    if (photos.length === 0) return;
    const items: MediaLightboxItem[] = photos.map((p) => ({
      id: p.id,
      kind: 'photo',
      name: p.caption || p.filename || 'تصویر پروژه',
      extension: p.filename?.split('.').pop()?.toLowerCase() ?? 'jpg',
      mime_type: 'image/jpeg',
      download_url: p.download_url || getPhotoFileUrl(p.id),
      thumbnail_url: p.thumbnail_url || getPhotoThumbUrl(p.id),
    }));
    setLightboxState({ items, index });
  }, []);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white"
      data-testid="project-group-tab"
    >
      {showFilterBar && (
        <ProjectStreamFilterBar
          filter={filter}
          onChange={setFilter}
          members={members}
          totalCount={stream.allItems.length}
          filteredCount={stream.items.length}
        />
      )}

      <ProjectStreamList
        projectId={projectId}
        items={stream.items}
        lastReadAt={room.initialLastReadAt}
        loading={room.loading || stream.loading}
        loadingMore={room.loadingOlder}
        hasMore={room.hasMore}
        onLoadMore={() => void room.loadOlder()}
        onReply={(item) => setReplyTo(item)}
        onReact={handleReact}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canDeleteAny={isAdminRole}
        onOpenTask={handleOpenTask}
        onOpenPhoto={handleOpenPhoto}
        replyCountsByItemId={stream.replyCountsByItemId}
        currentUserId={currentUserId}
      />

      <ProjectStreamComposer
        projectId={projectId}
        currentUser={currentUser}
        members={members}
        tasks={tasks}
        boards={boards}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
        onTasksChanged={onTasksChanged}
        onMeetingsChanged={() => {
          void stream.refresh();
        }}
      />

      <TaskQuickDetailDialog
        projectId={projectId}
        task={selectedTask}
        open={selectedTask !== null}
        members={members}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => {
          onTasksChanged?.();
          void stream.refresh();
        }}
      />

      {lightboxState && (
        <MediaLightbox
          open
          items={lightboxState.items}
          index={lightboxState.index}
          onClose={() => setLightboxState(null)}
          onIndexChange={(nextIndex) =>
            setLightboxState((prev) => (prev ? { ...prev, index: nextIndex } : null))
          }
        />
      )}
    </div>
  );
}
