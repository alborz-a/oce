import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/api';
import { useChatSocket, type SocketStatus } from '@/modules/team-chat/useChatSocket';
import type { ChatEvent, ChatMessage, ChatRoom } from '@/modules/team-chat/types';
import type { StreamQuotedEntity, StreamReactionMap } from '../types';

const PAGE_SIZE = 100;

export interface WorkspaceChatRoom extends ChatRoom {
  last_read_at?: string | null;
}

export interface SendWorkspaceMessageInput {
  text: string;
  replyToId?: string | null;
  documentIds?: string[];
  mentions?: string[];
  quotedEntity?: StreamQuotedEntity | null;
  metadata?: Record<string, unknown>;
}

export interface UseProjectWorkspaceRoomResult {
  room: WorkspaceChatRoom | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  /** True when the project room request was refused with HTTP 403 (no chat.read capability). */
  forbidden: boolean;
  socketStatus: SocketStatus;
  hasMore: boolean;
  loadingOlder: boolean;
  initialLastReadAt: string | null;
  initialUnreadCount: number;
  dismissUnreadSeparator: () => void;
  loadOlder: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  markRead: () => Promise<void>;
  sendMessage: (input: SendWorkspaceMessageInput) => Promise<ChatMessage | null>;
  editMessage: (messageId: string, text: string) => Promise<ChatMessage | null>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (
    messageId: string,
    emoji: string,
    currentUserId?: string | null,
  ) => Promise<ChatMessage | null>;
}

/** Merge chat messages ascending by created_at with stable id tie-breaker. */
export function mergeRoomMessages(
  current: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const msg of current) byId.set(msg.id, msg);
  for (const msg of incoming) byId.set(msg.id, msg);
  return [...byId.values()].sort((a, b) => {
    const dt = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (Number.isFinite(dt) && dt !== 0) return dt;
    return a.id.localeCompare(b.id);
  });
}

function toggleEmojiInReactions(
  existing: unknown,
  emoji: string,
  userId: string,
): StreamReactionMap {
  const next: StreamReactionMap = {};
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    for (const [key, list] of Object.entries(existing as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        next[key] = list.filter((v): v is string => typeof v === 'string');
      }
    }
  }
  const currentList = next[emoji] ?? [];
  if (currentList.includes(userId)) {
    const filtered = currentList.filter((id) => id !== userId);
    if (filtered.length > 0) {
      next[emoji] = filtered;
    } else {
      delete next[emoji];
    }
  } else {
    next[emoji] = [...currentList, userId];
  }
  return next;
}

export function useProjectWorkspaceRoom(
  projectId: string | null | undefined,
  enabled = true,
  roomOverride: WorkspaceChatRoom | null = null,
): UseProjectWorkspaceRoomResult {
  // When set (direct chat opened from the workspace), this room replaces the project room.
  const overrideRef = useRef<WorkspaceChatRoom | null>(roomOverride);
  overrideRef.current = roomOverride;
  const overrideRoomId = roomOverride?.id ?? null;
  const [room, setRoom] = useState<WorkspaceChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [initialLastReadAt, setInitialLastReadAt] = useState<string | null>(null);
  const [initialUnreadCount, setInitialUnreadCount] = useState(0);

  const activeProjectRef = useRef<string | null | undefined>(projectId);
  const activeRoomIdRef = useRef<string | null>(null);
  const unreadCapturedForRoomRef = useRef<string | null>(null);

  activeProjectRef.current = projectId;
  activeRoomIdRef.current = room?.id ?? null;

  const markReadForRoom = useCallback(async (roomId: string) => {
    try {
      await apiPost<void>(`/v1/team-chat/rooms/${roomId}/read/`);
      setRoom((cur) => (cur && cur.id === roomId ? { ...cur, unread: 0 } : cur));
    } catch {
      // Mark-read failure is non-fatal; polling/next read retries.
    }
  }, []);

  const markRead = useCallback(async () => {
    const rid = activeRoomIdRef.current;
    if (!rid) return;
    await markReadForRoom(rid);
  }, [markReadForRoom]);

  const dismissUnreadSeparator = useCallback(() => {
    setInitialLastReadAt(null);
    setInitialUnreadCount(0);
  }, []);

  const loadLatestMessages = useCallback(
    async (roomId: string, shouldMarkRead = false) => {
      const rows = await apiGet<ChatMessage[]>(
        `/v1/team-chat/rooms/${roomId}/messages/?limit=${PAGE_SIZE}`,
      );
      if (activeRoomIdRef.current !== roomId) return;
      setMessages((cur) => mergeRoomMessages(cur, rows));
      setHasMore((prev) => prev || rows.length >= PAGE_SIZE);
      if (shouldMarkRead) {
        void markReadForRoom(roomId);
      }
    },
    [markReadForRoom],
  );

  // Load or auto-create project chat room when projectId changes.
  useEffect(() => {
    setRoom(null);
    setMessages([]);
    setHasMore(false);
    setError(null);
    setForbidden(false);
    setInitialLastReadAt(null);
    setInitialUnreadCount(0);
    unreadCapturedForRoomRef.current = null;

    // A direct room (DM) can load without a project: projectId may be empty when overrideRef is set.
    if (!enabled || (!projectId && !overrideRef.current)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const [projectRoom, allRooms] = await Promise.all([
          overrideRef.current
            ? Promise.resolve(overrideRef.current)
            : apiGet<WorkspaceChatRoom>(`/v1/team-chat/rooms/project/${projectId}/`),
          apiGet<WorkspaceChatRoom[]>('/v1/team-chat/rooms/').catch(
            () => [] as WorkspaceChatRoom[],
          ),
        ]);
        if (cancelled || activeProjectRef.current !== projectId) return;

        const roomWithUnread = allRooms.find((r) => r.id === projectRoom.id);
        const mergedRoom: WorkspaceChatRoom = {
          ...projectRoom,
          unread: roomWithUnread?.unread ?? projectRoom.unread ?? 0,
          last_read_at: roomWithUnread?.last_read_at ?? projectRoom.last_read_at ?? null,
        };

        setRoom(mergedRoom);
        activeRoomIdRef.current = mergedRoom.id;

        if (unreadCapturedForRoomRef.current !== mergedRoom.id) {
          unreadCapturedForRoomRef.current = mergedRoom.id;
          setInitialLastReadAt(mergedRoom.last_read_at ?? null);
          setInitialUnreadCount(mergedRoom.unread ?? 0);
        }

        const initialMsgs = await apiGet<ChatMessage[]>(
          `/v1/team-chat/rooms/${mergedRoom.id}/messages/?limit=${PAGE_SIZE}`,
        );
        if (cancelled || activeProjectRef.current !== projectId) return;

        setMessages(mergeRoomMessages([], initialMsgs));
        setHasMore(initialMsgs.length >= PAGE_SIZE);
        setLoading(false);

        if ((mergedRoom.unread ?? 0) > 0) {
          void markReadForRoom(mergedRoom.id);
        }
      } catch (err) {
        if (cancelled || activeProjectRef.current !== projectId) return;
        const isForbidden = err instanceof ApiError && err.status === 403;
        setForbidden(isForbidden);
        setError(
          isForbidden
            ? 'شما اجازهٔ مشاهدهٔ گفتگوی این پروژه را ندارید. با مدیر پروژه تماس بگیرید.'
            : 'بارگذاری اتاق گفتگوی پروژه ممکن نشد.',
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, markReadForRoom, overrideRoomId]);

  const onSocketEvent = useCallback(
    (event: ChatEvent) => {
      const currentRoomId = activeRoomIdRef.current;
      if (!currentRoomId) return;

      if (event.event === 'message.created' || event.event === 'message.edited') {
        const msg = event.message;
        if (msg.room_id !== currentRoomId) return;
        setMessages((cur) => mergeRoomMessages(cur, [msg]));
        if (
          event.event === 'message.created' &&
          typeof document !== 'undefined' &&
          document.visibilityState !== 'hidden'
        ) {
          void markReadForRoom(currentRoomId);
        }
      } else if (event.event === 'message.deleted') {
        setMessages((cur) => cur.filter((m) => m.id !== event.message_id));
      } else if (event.event === 'room.read' && event.room_id === currentRoomId) {
        setRoom((cur) => (cur ? { ...cur, unread: 0 } : cur));
      }
    },
    [markReadForRoom],
  );

  const onSocketPoll = useCallback(() => {
    const currentRoomId = activeRoomIdRef.current;
    if (!currentRoomId) return;
    void loadLatestMessages(currentRoomId, false).catch(() => {});
  }, [loadLatestMessages]);

  const roomIds = useMemo(() => (room?.id ? [room.id] : []), [room?.id]);

  const socketStatus = useChatSocket({
    enabled: enabled && Boolean(room?.id),
    roomIds,
    onEvent: onSocketEvent,
    onPoll: onSocketPoll,
  });

  const refreshMessages = useCallback(async () => {
    const rid = activeRoomIdRef.current;
    if (!rid) return;
    await loadLatestMessages(rid, false);
  }, [loadLatestMessages]);

  const loadOlder = useCallback(async () => {
    const rid = activeRoomIdRef.current;
    const oldest = messages[0]?.id;
    if (!rid || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const olderRows = await apiGet<ChatMessage[]>(
        `/v1/team-chat/rooms/${rid}/messages/?limit=${PAGE_SIZE}&before=${oldest}`,
      );
      if (activeRoomIdRef.current !== rid) return;
      setMessages((cur) => mergeRoomMessages(olderRows, cur));
      setHasMore(olderRows.length >= PAGE_SIZE);
    } finally {
      setLoadingOlder(false);
    }
  }, [messages, loadingOlder]);

  const sendMessage = useCallback(
    async (input: SendWorkspaceMessageInput): Promise<ChatMessage | null> => {
      const rid = activeRoomIdRef.current;
      if (!rid) return null;

      const mergedMetadata: Record<string, unknown> | undefined =
        input.quotedEntity || input.metadata
          ? {
              ...(input.metadata ?? {}),
              ...(input.quotedEntity ? { quoted_entity: input.quotedEntity } : {}),
            }
          : undefined;

      const body: Record<string, unknown> = {
        text: input.text,
        reply_to_id: input.replyToId ?? null,
        document_ids: input.documentIds ?? [],
        mentions: input.mentions ?? [],
      };
      if (mergedMetadata) {
        body.metadata = mergedMetadata;
      }

      const created = await apiPost<ChatMessage>(
        `/v1/team-chat/rooms/${rid}/messages/`,
        body,
      );

      // Ensure quotedEntity renders immediately even if an older backend schema omits metadata echo.
      const normalized: ChatMessage =
        input.quotedEntity && !created.metadata?.quoted_entity
          ? {
              ...created,
              metadata: {
                ...(created.metadata ?? {}),
                quoted_entity: input.quotedEntity,
              },
            }
          : created;

      setMessages((cur) => mergeRoomMessages(cur, [normalized]));
      setInitialLastReadAt(null);
      setInitialUnreadCount(0);
      return normalized;
    },
    [],
  );

  const editMessage = useCallback(
    async (messageId: string, text: string): Promise<ChatMessage | null> => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const updated = await apiPatch<ChatMessage>(`/v1/team-chat/messages/${messageId}`, {
        text: trimmed,
      });
      setMessages((cur) => mergeRoomMessages(cur, [updated]));
      return updated;
    },
    [],
  );

  const deleteMessage = useCallback(async (messageId: string): Promise<void> => {
    await apiDelete(`/v1/team-chat/messages/${messageId}`);
    setMessages((cur) => cur.filter((m) => m.id !== messageId));
  }, []);

  const toggleReaction = useCallback(
    async (
      messageId: string,
      emoji: string,
      currentUserId?: string | null,
    ): Promise<ChatMessage | null> => {
      let snapshot: ChatMessage | undefined;
      if (currentUserId) {
        setMessages((cur) =>
          cur.map((m) => {
            if (m.id !== messageId) return m;
            snapshot = m;
            const nextReactions = toggleEmojiInReactions(
              m.metadata?.reactions,
              emoji,
              currentUserId,
            );
            return {
              ...m,
              metadata: {
                ...(m.metadata ?? {}),
                reactions: nextReactions,
              },
            };
          }),
        );
      }

      try {
        const updated = await apiPost<ChatMessage>(
          `/v1/team-chat/messages/${messageId}/reactions/`,
          { emoji },
        );
        setMessages((cur) => mergeRoomMessages(cur, [updated]));
        return updated;
      } catch (err) {
        if (snapshot) {
          const rollback = snapshot;
          setMessages((cur) => cur.map((m) => (m.id === messageId ? rollback : m)));
        }
        throw err;
      }
    },
    [],
  );

  return {
    room,
    messages,
    loading,
    error,
    forbidden,
    socketStatus,
    hasMore,
    loadingOlder,
    initialLastReadAt,
    initialUnreadCount,
    dismissUnreadSeparator,
    loadOlder,
    refreshMessages,
    markRead,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
  };
}
