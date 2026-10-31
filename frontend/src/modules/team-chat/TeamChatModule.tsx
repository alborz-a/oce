import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPatch, apiPost } from '@/shared/lib/api';
import type { Page } from '@/shared/lib/api';
import { fetchDocuments, uploadDocument } from '@/features/documents/api';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { RoomList } from './RoomList';
import { useChatSocket } from './useChatSocket';
import type { ChatEvent, ChatMessage, ChatRoom, ProjectDocument } from './types';

const PAGE = 50;

function mergeMessages(cur: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map(cur.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

/** Company, project, group and direct chat. Routes: /chat, /chat/:roomId, /projects/:projectId/chat. */
export default function TeamChatModule() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roomId, projectId } = useParams<{ roomId?: string; projectId?: string }>();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(roomId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<string | undefined>(activeId);
  activeRef.current = activeId;

  const active = rooms.find((r) => r.id === activeId);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await apiGet<ChatRoom[]>('/v1/team-chat/rooms/'));
    } catch {
      setError(t('team_chat.load_failed', { defaultValue: 'بارگذاری گفتگوها ممکن نشد' }));
    }
  }, [t]);

  const loadLatest = useCallback(async (id: string) => {
    const rows = await apiGet<ChatMessage[]>(`/v1/team-chat/rooms/${id}/messages/?limit=${PAGE}`);
    if (activeRef.current !== id) return;
    setMessages((cur) => mergeMessages(cur, rows));
    setHasMore(rows.length >= PAGE);
    void apiPost(`/v1/team-chat/rooms/${id}/read/`).then(loadRooms).catch(() => {});
  }, [loadRooms]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  // /projects/:projectId/chat opens (and creates) the project's room
  useEffect(() => {
    if (!projectId) return;
    apiGet<ChatRoom>(`/v1/team-chat/rooms/project/${projectId}/`)
      .then((r) => {
        setActiveId(r.id);
        void loadRooms();
      })
      .catch(() => setError(t('team_chat.no_access', { defaultValue: 'به این گفتگو دسترسی ندارید' })));
  }, [projectId, loadRooms, t]);

  useEffect(() => {
    if (roomId) setActiveId(roomId);
  }, [roomId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    if (activeId) loadLatest(activeId).catch(() => setError(t('team_chat.load_failed', { defaultValue: 'بارگذاری گفتگوها ممکن نشد' })));
  }, [activeId, loadLatest, t]);

  // documents of the room's project, for attaching
  useEffect(() => {
    setDocs([]);
    if (active?.kind !== 'project' || !active.project_id) return;
    fetchDocuments(active.project_id)
      .then((p: Page<{ id: string; name: string }>) => setDocs((p.items ?? []).map((d) => ({ id: d.id, name: d.name }))))
      .catch(() => {});
  }, [active?.kind, active?.project_id]);

  const onEvent = useCallback(
    (e: ChatEvent) => {
      if (e.event === 'message.created' || e.event === 'message.edited') {
        const m = e.message;
        if (m.room_id === activeRef.current) {
          setMessages((cur) => mergeMessages(cur, [m]));
          void apiPost(`/v1/team-chat/rooms/${m.room_id}/read/`).catch(() => {});
        } else {
          setRooms((cur) => cur.map((r) => (r.id === m.room_id ? { ...r, unread: r.unread + 1, last_message_at: m.created_at } : r)));
        }
      } else if (e.event === 'room.read') {
        setRooms((cur) => cur.map((r) => (r.id === e.room_id ? { ...r, unread: 0 } : r)));
      }
    },
    [],
  );

  const roomIds = useMemo(() => rooms.map((r) => r.id), [rooms]);
  const status = useChatSocket({
    enabled: true,
    roomIds,
    onEvent,
    onPoll: () => {
      void loadRooms();
      if (activeRef.current) loadLatest(activeRef.current).catch(() => {});
    },
  });

  const loadOlder = async () => {
    if (!activeId || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const rows = await apiGet<ChatMessage[]>(`/v1/team-chat/rooms/${activeId}/messages/?limit=${PAGE}&before=${messages[0]!.id}`);
      setMessages((cur) => mergeMessages(cur, rows));
      setHasMore(rows.length >= PAGE);
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (text: string, documentIds: string[]) => {
    if (!activeId) return;
    const m = await apiPost<ChatMessage>(`/v1/team-chat/rooms/${activeId}/messages/`, { text, document_ids: documentIds });
    setMessages((cur) => mergeMessages(cur, [m]));
  };

  const upload = async (file: File): Promise<ProjectDocument | null> => {
    if (active?.kind !== 'project' || !active.project_id) return null;
    try {
      const d = await uploadDocument(active.project_id, file, 'other');
      return { id: d.id, name: d.name };
    } catch {
      setError(t('team_chat.upload_failed', { defaultValue: 'بارگذاری فایل ناموفق بود' }));
      return null;
    }
  };

  const newGroup = async () => {
    const name = window.prompt(t('team_chat.group_name', { defaultValue: 'نام گروه' }));
    if (!name) return;
    const me = await apiGet<{ id: string }>('/v1/users/me/');
    const r = await apiPost<ChatRoom>('/v1/team-chat/rooms/', { kind: 'group', name, member_ids: [me.id] });
    await loadRooms();
    navigate(`/chat/${r.id}`);
  };

  const docNames = useMemo(() => Object.fromEntries(docs.map((d) => [d.id, d.name])), [docs]);
  void apiPatch; // message editing UI is a follow-up; the API is ready

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[420px]" dir="rtl" data-testid="team-chat">
      <div className="w-64 shrink-0">
        <RoomList
          rooms={rooms}
          activeId={activeId}
          onSelect={(r) => {
            setActiveId(r.id);
            navigate(`/chat/${r.id}`);
          }}
          onNewGroup={newGroup}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border-light px-3 py-2 text-sm font-semibold" dir="auto">
          {active ? (active.kind === 'company' ? t('team_chat.company', { defaultValue: 'شرکت' }) : active.name) : t('team_chat.pick', { defaultValue: 'یک گفتگو را انتخاب کنید' })}
        </div>
        {status !== 'open' && (
          <div className="bg-amber-50 px-3 py-1 text-xs text-amber-800" data-testid="offline-banner">
            {t('team_chat.offline', { defaultValue: 'اتصال زنده قطع است؛ هر ۱۵ ثانیه به‌روزرسانی می‌شود' })}
          </div>
        )}
        {error && <div className="px-3 py-1 text-xs text-red-600">{error}</div>}
        {active ? (
          <>
            <MessageList messages={messages} hasMore={hasMore} loadingOlder={loadingOlder} onLoadOlder={loadOlder} documentNames={docNames} />
            <Composer documents={docs} onSend={send} onUpload={active.kind === 'project' ? upload : undefined} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-content-tertiary">
            {t('team_chat.pick', { defaultValue: 'یک گفتگو را انتخاب کنید' })}
          </div>
        )}
      </div>
    </div>
  );
}
