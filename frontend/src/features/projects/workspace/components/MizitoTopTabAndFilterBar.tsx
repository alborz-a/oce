import type { ReactNode } from 'react';
import { MzIcon } from './MzIcon';
import { BarChart2, Calendar, CheckCircle2, ClipboardList, Columns3, Compass, FileText, GanttChart, ImageIcon, MessageSquare, PanelRight, Video } from 'lucide-react';
import {
  DEFAULT_STREAM_FILTERS,
  type StreamFilterState,
  type WorkspaceTabKey,
} from '../types';

export interface MizitoTopTabAndFilterBarProps {
  activeTab: WorkspaceTabKey;
  onTabChange: (tab: WorkspaceTabKey) => void;
  filters?: StreamFilterState;
  onFiltersChange?: (next: StreamFilterState) => void;
  /** Optional custom filter bar slot (e.g. ProjectStreamFilterBar with popovers). */
  filterSlot?: ReactNode;
  /** Admin switch to return to the full OCE engineering dashboard. */
  canSwitchToEngineering?: boolean;
  onSwitchToEngineering?: () => void;
  /** Responsive triggers on narrow viewports. */
  onOpenMobileSummary?: () => void;
  /** Optional callbacks when sender or date icon is clicked in built-in bar. */
  onSenderFilterClick?: () => void;
  onDateFilterClick?: () => void;
}

interface TabDef {
  key: WorkspaceTabKey;
  label: string;
  Icon: typeof MessageSquare;
  color: string;
}

const WORKSPACE_TABS: readonly TabDef[] = [
  { key: 'group', color: '#4b9fff', label: 'گروه پروژه', Icon: MessageSquare },
  { key: 'tasks', color: '#546e7a', label: 'وظایف پروژه', Icon: CheckCircle2 },
  { key: 'board', color: '#5c6bc0', label: 'بورد پروژه', Icon: Columns3 },
  { key: 'calendar', color: '#6ab04c', label: 'تقویم پروژه', Icon: Calendar },
  { key: 'gantt', color: '#3078ab', label: 'گانت پروژه', Icon: GanttChart },
];

interface KindIconDef {
  kind: StreamFilterState['kind'];
  label: string;
  Icon: typeof CheckCircle2;
}

const KIND_FILTERS: readonly KindIconDef[] = [
  { kind: 'tasks', label: 'فقط وظایف و گزارش‌ها', Icon: CheckCircle2 },
  { kind: 'minutes', label: 'فقط صورتجلسه‌ها و اسناد متنی', Icon: ClipboardList },
  { kind: 'documents', label: 'فقط فایل‌ها و PDF', Icon: FileText },
  { kind: 'photos', label: 'فقط عکس‌ها و آلبوم‌ها', Icon: ImageIcon },
  { kind: 'videos', label: 'فقط پیام‌های جلسه ویدیویی', Icon: Video },
  { kind: 'polls', label: 'نظرسنجی و وضعیت ویژه', Icon: BarChart2 },
];

export function MizitoTopTabAndFilterBar({
  activeTab,
  onTabChange,
  filters = DEFAULT_STREAM_FILTERS,
  onFiltersChange,
  filterSlot,
  canSwitchToEngineering = false,
  onSwitchToEngineering,
  onOpenMobileSummary,
  onSenderFilterClick,
  onDateFilterClick,
}: MizitoTopTabAndFilterBarProps) {
  const hasActiveFilter =
    filters.search.trim().length > 0 ||
    filters.senderId !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.kind !== 'all';

  const toggleKind = (kind: StreamFilterState['kind']) => {
    if (!onFiltersChange) return;
    onFiltersChange({
      ...filters,
      kind: filters.kind === kind ? 'all' : kind,
    });
  };

  return (
    <header
      className="mz-top-tabbar mz-shell font-mz"
      data-testid="mizito-top-tabbar"
    >
      {/* Start (Right in RTL): responsive toggles + 5 primary Mizito tabs */}
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {onOpenMobileSummary && (
          <button
            type="button"
            onClick={onOpenMobileSummary}
            aria-label="باز کردن پنل اطلاعات پروژه"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#5b5e66] hover:bg-[#f2f4f7] md:hidden"
          >
            <PanelRight size={17} />
          </button>
        )}

        <nav
          role="tablist"
          aria-label="بخش‌های فضای کار پروژه"
          className="flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto"
        >
          {WORKSPACE_TABS.map(({ key, label, Icon, color }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`workspace-tab-${key}`}
                onClick={() => onTabChange(key)}
                className={isActive ? 'submenu_tab submenu_tab--active' : 'submenu_tab'}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" style={{ color }} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* End (Left in RTL): stream filter controls (Tab 1) + Admin Engineering switch */}
      <div className="flex shrink-0 items-center gap-2">
        {activeTab === 'group' &&
          (filterSlot ?? (
            <div
              className="flex items-center gap-1"
              data-testid="topbar-default-stream-filter"
            >
              <search className="relative flex items-center">
                <MzIcon name="search"
                  size={13}
                  className="pointer-events-none absolute start-2.5 text-[#909090]"
                 />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) =>
                    onFiltersChange?.({ ...filters, search: e.target.value })
                  }
                  placeholder="فیلتر پیام‌ها"
                  aria-label="فیلتر پیام‌ها"
                  data-testid="stream-filter-search"
                  className="h-7 w-36 rounded-full border border-[#e5e7eb] bg-[#f5f6f8] ps-7 pe-3 text-[12px] text-[#1f2937] placeholder:text-[#909090] focus:w-44 focus:border-mz-project focus:bg-white focus:outline-none transition-all"
                />
              </search>

              {/* 9-icon Mizito filter strip */}
              <div className="hidden items-center gap-0.5 lg:flex">
                <button
                  type="button"
                  title="جستجوی متنی"
                  aria-label="جستجوی متنی"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>(
                      '[data-testid="stream-filter-search"]',
                    );
                    input?.focus();
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f2f4f7] hover:text-mz-project"
                >
                  <MzIcon name="search" size={15} />
                </button>

                <button
                  type="button"
                  title="فیلتر بر اساس ارسال‌کننده"
                  aria-label="فیلتر بر اساس ارسال‌کننده"
                  aria-pressed={filters.senderId !== null}
                  onClick={onSenderFilterClick}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    filters.senderId !== null
                      ? 'bg-[#e8f2fa] text-mz-project'
                      : 'text-[#6b7280] hover:bg-[#f2f4f7] hover:text-mz-project'
                  }`}
                >
                  <MzIcon name="person" size={15} />
                </button>

                <button
                  type="button"
                  title="فیلتر بازه تاریخ شمسی"
                  aria-label="فیلتر بازه تاریخ شمسی"
                  aria-pressed={filters.dateFrom !== null || filters.dateTo !== null}
                  onClick={onDateFilterClick}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    filters.dateFrom !== null || filters.dateTo !== null
                      ? 'bg-[#e8f2fa] text-mz-project'
                      : 'text-[#6b7280] hover:bg-[#f2f4f7] hover:text-mz-project'
                  }`}
                >
                  <MzIcon name="event_note" size={15} />
                </button>

                {KIND_FILTERS.map(({ kind, label, Icon }) => {
                  const active = filters.kind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={active}
                      data-testid={`stream-filter-kind-${kind}`}
                      onClick={() => toggleKind(kind)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                        active
                          ? 'bg-[#e8f2fa] text-mz-project'
                          : 'text-[#6b7280] hover:bg-[#f2f4f7] hover:text-mz-project'
                      }`}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}

                {hasActiveFilter && (
                  <button
                    type="button"
                    title="پاک کردن فیلترها"
                    aria-label="پاک کردن فیلترها"
                    data-testid="stream-filter-clear"
                    onClick={() => onFiltersChange?.(DEFAULT_STREAM_FILTERS)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#d9534f] hover:bg-[#fef2f2]"
                  >
                    <MzIcon name="close" size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}

        {canSwitchToEngineering && onSwitchToEngineering && (
          <button
            type="button"
            onClick={onSwitchToEngineering}
            data-testid="switch-to-engineering-view"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-[#f5f6f8] px-2.5 text-[11.5px] font-medium text-[#2b4162] hover:border-mz-project hover:bg-[#e8f2fa] hover:text-mz-project transition-colors whitespace-nowrap"
          >
            <Compass size={13} aria-hidden="true" />
            <span>ورود به حالت مهندسی</span>
          </button>
        )}
      </div>
    </header>
  );
}
