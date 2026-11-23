import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toPersianDigits } from '@/shared/lib/jalali';
import { MzIcon } from '@/features/projects/workspace/components/MzIcon';
import { JobTitleBadge } from '@/shared/ui/JobTitleBadge';
import { useJobTitles } from '@/shared/lib/useJobTitles';
import type { ChatRoom, RoomKind } from './types';

const KIND_ORDER: Record<RoomKind, number> = { company: 0, project: 1, group: 2, channel: 3, dm: 4 };

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

type Tab = 'all' | 'groups' | 'members';

const TABS: { key: Tab; icon: string; label: string; color: string }[] = [
  { key: 'all', icon: 'chat', label: 'همه', color: '#4285f4' },
  { key: 'groups', icon: 'group', label: 'گروه‌ها', color: '#536dfe' },
  { key: 'members', icon: 'person', label: 'اعضا', color: '#ff6839' },
];

function roomIcon(r: ChatRoom): { name: string; color?: string } {
  if (r.name.includes('دستیار میزیتو')) return { name: 'assistant', color: '#c2185b' };
  switch (r.kind) {
    case 'company':
      return { name: 'group' };
    case 'project':
      return { name: 'folder' };
    case 'group':
      return { name: 'group' };
    case 'channel':
      return { name: 'record_voice_over' };
    default:
      return { name: 'person' };
  }
}

interface Props {
  rooms: ChatRoom[];
  activeId?: string;
  onSelect: (room: ChatRoom) => void;
  onNewGroup?: () => void;
  onNewDm?: () => void;
  onNewChannel?: () => void;
}

export function RoomList({ rooms, activeId, onSelect, onNewGroup, onNewDm, onNewChannel }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const jobTitles = useJobTitles();
  const label = (r: ChatRoom) =>
    r.kind === 'company' ? t('team_chat.company', { defaultValue: 'شرکت' }) : r.name || t('team_chat.unnamed', { defaultValue: 'بدون نام' });

  const q = query.trim().toLowerCase();
  const visible = orderRooms(rooms)
    .filter((r) => (tab === 'all' ? true : tab === 'groups' ? r.kind === 'group' || r.kind === 'channel' : r.kind === 'dm'))
    .filter((r) => label(r).toLowerCase().includes(q));

  const newItems: { key: string; icon: string; text: string; short: string; handler?: () => void }[] = [
    { key: 'dm', icon: 'person', text: 'ارسال پیام شخصی', short: 'پیام شخصی', handler: onNewDm },
    { key: 'group', icon: 'group_add', text: 'ایجاد گروه گفتگو', short: 'ایجاد گروه گفتگو', handler: onNewGroup },
    { key: 'channel', icon: 'record_voice_over', text: 'ایجاد کانال', short: 'ایجاد کانال', handler: onNewChannel },
  ];

  return (
    <div className="flex h-full flex-col border-s border-border-light" data-testid="room-list">
      <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
        <span>{t('team_chat.title', { defaultValue: 'گفتگو' })}</span>
      </div>

      <div role="tablist" className="flex border-b border-border-light">
        {TABS.map((tb) => {
          const isActive = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(tb.key)}
              className={`flex flex-1 items-center justify-center gap-1 border-t-[3px] py-2 text-sm ${isActive ? '' : 'border-transparent'}`}
              style={isActive ? { borderTopColor: tb.color } : undefined}
            >
              <MzIcon name={tb.icon} size={20} color={isActive ? tb.color : undefined} />
              {isActive && <span>{tb.label}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-2 py-2">
        <div className="relative flex-1">
          <input
            type="text"
            dir="auto"
            placeholder="فیلتر"
            aria-label="فیلتر"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[4px] border border-[#e0e0e0] bg-white py-1 ps-2 pe-8 text-sm"
          />
          <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center">
            <MzIcon name="search" size={18} color="#757575" />
          </span>
        </div>
        <div className="relative hidden md:inline-flex">
          <button
            type="button"
            aria-label="گفتگوی جدید"
            data-testid="room-new-menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center justify-center"
          >
            <MzIcon name="add_circle_outline" size={24} color="#4285f4" />
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-full z-20 mt-1 w-56 rounded border border-border-light bg-white py-1 shadow-lg">
              {newItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    item.handler?.();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-secondary disabled:opacity-50"
                >
                  <MzIcon name={item.icon} size={20} />
                  {item.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {visible.map((r) => {
          const ic = roomIcon(r);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                data-room-id={r.id}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-surface-secondary ${
                  r.id === activeId ? 'bg-surface-secondary font-semibold' : ''
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                    <MzIcon name={ic.name} size={20} color={ic.color} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span dir="auto" className="truncate font-semibold">
                      {label(r)}
                    </span>
                    {r.kind === 'dm' && <JobTitleBadge title={jobTitles.byName.get(r.name.trim())} />}
                  </span>
                </span>
                {r.unread > 0 && (
                  <span className="rounded-full bg-oe-blue px-2 text-xs text-white" data-testid="unread-badge">
                    {toPersianDigits(r.unread)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {onNewGroup && (
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-border-light bg-white px-2 py-2">
          <button
            type="button"
            data-testid="room-new-group-footer"
            onClick={onNewGroup}
            className="flex items-center gap-1 rounded bg-oe-blue px-3 py-1 text-sm text-white"
          >
            <MzIcon name="group_add" size={18} color="#ffffff" />
            گروه جدید
          </button>
        </div>
      )}

      <div className="md:hidden fixed bottom-4 left-4 z-30 flex flex-col-reverse gap-2">
        <button
          type="button"
          aria-label="گفتگوی جدید"
          data-testid="room-fab"
          onClick={() => setFabOpen((o) => !o)}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
          style={{ backgroundColor: '#4285f4' }}
        >
          <MzIcon name={fabOpen ? 'close' : 'add'} size={28} color="#ffffff" />
        </button>
        {fabOpen &&
          newItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={item.text}
                onClick={() => {
                  setFabOpen(false);
                  item.handler?.();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow disabled:opacity-50"
              >
                <MzIcon name={item.icon} size={20} />
              </button>
              <span className="rounded-full bg-[#424242] px-3 py-1 text-xs text-white">{item.short}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
