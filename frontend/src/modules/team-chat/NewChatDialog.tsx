import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '@/shared/lib/api';
import { WideModal } from '@/shared/ui/WideModal';
import { JobTitleBadge } from '@/shared/ui/JobTitleBadge';
import type { ChatRoom, Colleague, RoomKind } from './types';

export type NewChatMode = 'dm' | 'group' | 'channel';

interface Props {
  mode: NewChatMode;
  me: { id: string };
  onClose: () => void;
  onCreated: (room: ChatRoom) => void;
}

const TITLES: Record<NewChatMode, string> = {
  dm: 'پیام شخصی',
  group: 'ایجاد گروه گفتگو',
  channel: 'ایجاد کانال',
};

/** Create a direct message, group or channel. Direct messages are created on a single colleague click. */
export function NewChatDialog({ mode, me, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<Colleague[]>('/v1/team-chat/colleagues/')
      .then((rows) => {
        if (alive) setColleagues(rows ?? []);
      })
      .catch(() => {
        if (alive) setError(t('team_chat.load_failed', { defaultValue: 'بارگذاری گفتگوها ممکن نشد' }));
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => colleagues.filter((c) => (c.full_name || '').toLowerCase().includes(q)),
    [colleagues, q],
  );

  const create = async (kind: RoomKind, body: { name?: string; member_ids: string[] }) => {
    setSubmitting(true);
    setError(null);
    try {
      const room = await apiPost<ChatRoom>('/v1/team-chat/rooms/', { kind, ...body });
      onCreated(room);
      onClose();
    } catch {
      setError(t('team_chat.create_failed', { defaultValue: 'ایجاد گفتگو ناموفق بود' }));
    } finally {
      setSubmitting(false);
    }
  };

  const onPickDm = (other: Colleague) => {
    if (submitting) return;
    void create('dm', { member_ids: [me.id, other.id] });
  };

  const toggle = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const trimmedName = name.trim();
  const canSubmit = !submitting && trimmedName.length > 0;
  const onSubmit = () => {
    if (!canSubmit) return;
    void create(mode === 'channel' ? 'channel' : 'group', { name: trimmedName, member_ids: [me.id, ...selected] });
  };

  return (
    <WideModal
      open
      onClose={onClose}
      title={TITLES[mode]}
      busy={submitting}
      testId="new-chat-dialog"
      footer={
        mode === 'dm' ? undefined : (
          <button
            type="button"
            data-testid="new-chat-submit"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="rounded bg-oe-blue px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            ایجاد
          </button>
        )
      }
    >
      <div dir="rtl" className="space-y-3">
        {mode !== 'dm' && (
          <input
            type="text"
            dir="auto"
            data-testid="new-chat-name"
            aria-label="نام"
            placeholder={mode === 'channel' ? 'نام کانال' : 'نام گروه'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[4px] border border-[#e0e0e0] bg-white px-2 py-1 text-sm"
          />
        )}
        <input
          type="text"
          dir="auto"
          aria-label="جستجوی همکار"
          placeholder="جستجو"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-[4px] border border-[#e0e0e0] bg-white px-2 py-1 text-sm"
        />
        <ul className="max-h-[360px] overflow-y-auto">
          {visible.map((c) => {
            const content = (
              <>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: '#1f5c88' }}
                >
                  {(c.full_name || '?').charAt(0)}
                </span>
                <span dir="auto" className="truncate">
                  {c.full_name}
                </span>
                <JobTitleBadge title={c.job_title} />
              </>
            );
            return (
              <li key={c.id}>
                {mode === 'dm' ? (
                  <button
                    type="button"
                    data-testid="colleague-row"
                    disabled={submitting}
                    onClick={() => onPickDm(c)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-surface-secondary"
                  >
                    {content}
                  </button>
                ) : (
                  <label
                    data-testid="colleague-row"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm hover:bg-surface-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      aria-label={c.full_name}
                    />
                    {content}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    </WideModal>
  );
}
