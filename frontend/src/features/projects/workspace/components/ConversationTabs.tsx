import { MzIcon } from './MzIcon';
import type { ConversationTab } from '../utils/filterConversations';

const TABS: { value: ConversationTab; label: string; icon?: string }[] = [
  { value: 'all', label: 'همه', icon: 'chat' },
  { value: 'groups', label: 'گروه‌ها', icon: 'group' },
  { value: 'members', label: 'اعضا', icon: 'people' },
];

/** Segmented tablist for the conversations page. Controlled: parent owns the selected tab. */
export function ConversationTabs({
  value,
  onChange,
}: {
  value: ConversationTab;
  onChange: (next: ConversationTab) => void;
}) {
  return (
    <div role="tablist" aria-label="نوع گفتگو" dir="rtl" className="flex border-b border-[#e5eaf0]" data-testid="conversation-tabs">
      {TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`conversation-tab-${tab.value}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            data-testid={`conversation-tab-${tab.value}`}
            className={`flex flex-1 items-center justify-center gap-1 px-3 py-2 text-sm ${
              selected ? 'border-b-2 border-[var(--mz-appbar)] font-bold text-[#263648]' : 'text-[var(--mz-muted)]'
            }`}
          >
            {tab.icon && <MzIcon name={tab.icon} size={18} />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
