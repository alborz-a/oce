import { useTranslation } from 'react-i18next';
import { toPersianDigits } from '@/shared/lib/jalali';
import type { ChatRoom, RoomKind } from './types';

const KIND_ORDER: Record<RoomKind, number> = { company: 0, project: 1, group: 2, dm: 3 };

/** Company room first, then projects, groups and direct messages; newest activity first inside a kind. */
export function orderRooms(rooms: ChatRoom[]): ChatRoom[] {
  return [...rooms].sort((a, b) => {
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (k !== 0) return k;
    const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
    const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
    if (ta !== tb) return tb - ta;
    return a.name.localeCompare(b.name, 'fa');
  });
}

interface Props {
  rooms: ChatRoom[];
  activeId?: string;
  onSelect: (room: ChatRoom) => void;
  onNewGroup?: () => void;
}

export function RoomList({ rooms, activeId, onSelect, onNewGroup }: Props) {
  const { t } = useTranslation();
  const label = (r: ChatRoom) =>
    r.kind === 'company' ? t('team_chat.company', { defaultValue: 'شرکت' }) : r.name || t('team_chat.unnamed', { defaultValue: 'بدون نام' });
  return (
    <div className="flex h-full flex-col border-s border-border-light" data-testid="room-list">
      <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
        <span>{t('team_chat.title', { defaultValue: 'گفتگو' })}</span>
        {onNewGroup && (
          <button type="button" className="text-xs text-oe-blue" onClick={onNewGroup}>
            {t('team_chat.new_group', { defaultValue: 'گروه جدید' })}
          </button>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {orderRooms(rooms).map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              data-room-id={r.id}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-surface-secondary ${
                r.id === activeId ? 'bg-surface-secondary font-semibold' : ''
              }`}
            >
              <span dir="auto" className="truncate">
                {label(r)}
              </span>
              {r.unread > 0 && (
                <span className="rounded-full bg-oe-blue px-2 text-xs text-white" data-testid="unread-badge">
                  {toPersianDigits(r.unread)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
