import { useId, useRef, useState } from 'react';
import { MzIcon } from './MzIcon';
import { isoToJalali, toPersianDigits } from '@/shared/lib/jalali';
import { JalaliDateInput } from '@/shared/ui/JalaliDateInput';
import {
  DEFAULT_STREAM_FILTERS,
  type StreamFilterState,
  type WorkspaceMember,
} from '../types';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';

export type ProjectMemberSummary = Pick<WorkspaceMember, 'user_id' | 'full_name'> &
  Partial<WorkspaceMember>;

export interface ProjectStreamFilterBarProps {
  filter: StreamFilterState;
  onChange: (next: StreamFilterState) => void;
  members: ProjectMemberSummary[];
  totalCount?: number;
  filteredCount?: number;
}

interface KindToggleDef {
  kind: StreamFilterState['kind'];
  label: string;
  /** Material Icons ligature name rendered via MzIcon. */
  ligature: string;
}

const KIND_TOGGLES: readonly KindToggleDef[] = [
  { kind: 'tasks', label: 'فقط وظایف و گزارش‌ها', ligature: 'check_circle' },
  { kind: 'minutes', label: 'فقط صورتجلسه‌ها و اسناد متنی', ligature: 'assignment' },
  { kind: 'documents', label: 'فقط فایل‌ها و PDF', ligature: 'description' },
  { kind: 'photos', label: 'فقط عکس‌ها و آلبوم‌ها', ligature: 'image' },
  { kind: 'videos', label: 'فقط پیام‌های جلسه ویدیویی', ligature: 'videocam' },
  { kind: 'polls', label: 'نظرسنجی و وضعیت ویژه', ligature: 'bar_chart' },
];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ProjectStreamFilterBar({
  filter,
  onChange,
  members,
  totalCount,
  filteredCount,
}: ProjectStreamFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const senderPopoverRef = useRef<HTMLDivElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const senderPopoverId = useId();
  const datePopoverId = useId();
  const [fallbackPanel, setFallbackPanel] = useState<'sender' | 'date' | null>(null);
  const senderTriggerRef = useRef<HTMLButtonElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  useAnchoredPopover(senderTriggerRef, senderPopoverRef, fallbackPanel === 'sender');
  useAnchoredPopover(dateTriggerRef, datePopoverRef, fallbackPanel === 'date');

  const hasActiveFilter =
    filter.search.trim().length > 0 ||
    filter.senderId !== null ||
    filter.dateFrom !== null ||
    filter.dateTo !== null ||
    filter.kind !== 'all';

  const supportsNativePopover =
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.togglePopover === 'function';

  const togglePopoverPanel = (panel: 'sender' | 'date') => {
    const targetRef = panel === 'sender' ? senderPopoverRef : datePopoverRef;
    const el = targetRef.current as (HTMLDivElement & { togglePopover?: () => void }) | null;
    if (supportsNativePopover && el?.togglePopover) {
      try {
        el.togglePopover();
        return;
      } catch {
        // Fall through to state-controlled panel if browser rejects togglePopover
      }
    }
    setFallbackPanel((prev) => (prev === panel ? null : panel));
  };

  const closePopoverPanel = (panel: 'sender' | 'date') => {
    const targetRef = panel === 'sender' ? senderPopoverRef : datePopoverRef;
    const el = targetRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null;
    if (supportsNativePopover && el?.hidePopover) {
      try {
        el.hidePopover();
      } catch {
        // Ignore if not currently open
      }
    }
    setFallbackPanel((prev) => (prev === panel ? null : prev));
  };

  const toggleKind = (kind: StreamFilterState['kind']) => {
    onChange({
      ...filter,
      kind: filter.kind === kind ? 'all' : kind,
    });
  };

  const applyDatePreset = (daysBack: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - daysBack);
    onChange({
      ...filter,
      dateFrom: toIsoDate(start),
      dateTo: toIsoDate(today),
    });
    closePopoverPanel('date');
  };

  const selectedSender = filter.senderId
    ? members.find((m) => m.user_id === filter.senderId)
    : undefined;

  const popoverAttrs = { popover: 'auto' } as React.HTMLAttributes<HTMLDivElement>;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-[4px] border border-[#e0e0e0] bg-white px-2 py-0.5"
      data-testid="project-stream-filter-bar"
    >
      <span className="shrink-0 text-[12px] text-black/60">فیلتر پیام‌ها:</span>
      <search className="relative flex items-center" aria-label="فیلتر پیام‌ها">
        <MzIcon name="search" size={14} className="pointer-events-none absolute start-2.5 text-[#909090]" />
        <input
          ref={searchInputRef}
          type="search"
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          placeholder="فیلتر پیام‌ها"
          aria-label="فیلتر پیام‌ها"
          className="h-7 w-32 rounded-none border-0 bg-transparent pe-3 ps-8 text-[12px] text-black/85 placeholder:text-[#909090] focus:w-40 focus:outline-none"
        />
      </search>

      {/* 9-icon Mizito stream filter toolbar */}
      <div className="flex items-center gap-0.5 px-1 py-0.5">
        {/* 1. Focus text search */}
        <button
          type="button"
          onClick={() => searchInputRef.current?.focus()}
          title="جستجوی متنی"
          aria-label="جستجوی متنی"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#5b5e66] transition-colors hover:bg-white hover:text-[#3078ab]"
        >
          <MzIcon name="search" size={14} />
        </button>

        {/* 2. Sender picker popover */}
        <div className="relative">
          <button
            ref={senderTriggerRef}
            type="button"
            {...({ popovertarget: senderPopoverId } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            onClick={() => {
              if (!supportsNativePopover) togglePopoverPanel('sender');
            }}
            title={selectedSender ? `فرستنده: ${selectedSender.full_name}` : 'فیلتر بر اساس فرستنده'}
            aria-label="فیلتر بر اساس فرستنده"
            aria-pressed={filter.senderId !== null}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              filter.senderId !== null
                ? 'bg-[#3078ab] text-white'
                : 'text-[#5b5e66] hover:bg-white hover:text-[#3078ab]'
            }`}
          >
            <MzIcon name="person" size={14} />
          </button>

          <div
            ref={senderPopoverRef}
            id={senderPopoverId}
            {...popoverAttrs}
            style={
              supportsNativePopover
                ? undefined
                : { display: fallbackPanel === 'sender' ? 'block' : 'none' }
            }
            className={`min-w-[210px] max-w-[260px] rounded-lg border border-[#e5e7eb] bg-white p-2 shadow-lg ${
              !supportsNativePopover && fallbackPanel === 'sender'
                ? 'absolute start-0 top-full z-30 mt-1'
                : ''
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between border-b border-[#f2f4f7] pb-1 text-[11.5px] font-semibold text-black/80">
              <span>انتخاب ارسال‌کننده</span>
              {filter.senderId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...filter, senderId: null });
                    closePopoverPanel('sender');
                  }}
                  className="text-[11px] font-normal text-[#3078ab] hover:underline"
                >
                  همه
                </button>
              )}
            </div>
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...filter, senderId: null });
                    closePopoverPanel('sender');
                  }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-[12px] ${
                    filter.senderId === null
                      ? 'bg-[#3078ab]/10 font-semibold text-[#3078ab]'
                      : 'text-black/80 hover:bg-[#f5f6f8]'
                  }`}
                >
                  <span>همه اعضا</span>
                  {filter.senderId === null && <MzIcon name="check" size={13} />}
                </button>
              </li>
              {members.map((member) => {
                const active = filter.senderId === member.user_id;
                const label = member.full_name || member.email || member.user_id;
                return (
                  <li key={member.user_id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({
                          ...filter,
                          senderId: active ? null : member.user_id,
                        });
                        closePopoverPanel('sender');
                      }}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-[12px] ${
                        active
                          ? 'bg-[#3078ab]/10 font-semibold text-[#3078ab]'
                          : 'text-black/80 hover:bg-[#f5f6f8]'
                      }`}
                    >
                      <span className="truncate">{label}</span>
                      {active && <MzIcon name="check" size={13} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 3. Jalali/Gregorian date range popover */}
        <div className="relative">
          <button
            ref={dateTriggerRef}
            type="button"
            {...({ popovertarget: datePopoverId } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            onClick={() => {
              if (!supportsNativePopover) togglePopoverPanel('date');
            }}
            title="فیلتر بازه تاریخ"
            aria-label="فیلتر بازه تاریخ"
            aria-pressed={filter.dateFrom !== null || filter.dateTo !== null}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              filter.dateFrom !== null || filter.dateTo !== null
                ? 'bg-[#3078ab] text-white'
                : 'text-[#5b5e66] hover:bg-white hover:text-[#3078ab]'
            }`}
          >
            <MzIcon name="event" size={14} />
          </button>

          <div
            ref={datePopoverRef}
            id={datePopoverId}
            {...popoverAttrs}
            style={
              supportsNativePopover
                ? undefined
                : { display: fallbackPanel === 'date' ? 'block' : 'none' }
            }
            className={`w-64 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-lg ${
              !supportsNativePopover && fallbackPanel === 'date'
                ? 'absolute start-0 top-full z-30 mt-1'
                : ''
            }`}
          >
            <div className="mb-2 flex items-center justify-between text-[11.5px] font-semibold text-black/80">
              <span>بازه تاریخ (شمسی / میلادی)</span>
              {(filter.dateFrom || filter.dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...filter, dateFrom: null, dateTo: null });
                    closePopoverPanel('date');
                  }}
                  className="text-[11px] font-normal text-[#d9534f] hover:underline"
                >
                  پاک کردن
                </button>
              )}
            </div>

            <div className="mb-2.5 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => applyDatePreset(0)}
                className="rounded-full border border-[#e0e0e0] bg-[#f5f6f8] px-2.5 py-0.5 text-[11px] text-black/80 hover:border-[#3078ab] hover:text-[#3078ab]"
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset(7)}
                className="rounded-full border border-[#e0e0e0] bg-[#f5f6f8] px-2.5 py-0.5 text-[11px] text-black/80 hover:border-[#3078ab] hover:text-[#3078ab]"
              >
                {toPersianDigits(7)} روز گذشته
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset(30)}
                className="rounded-full border border-[#e0e0e0] bg-[#f5f6f8] px-2.5 py-0.5 text-[11px] text-black/80 hover:border-[#3078ab] hover:text-[#3078ab]"
              >
                {toPersianDigits(30)} روز گذشته
              </button>
            </div>

            <div className="space-y-2 text-[11.5px]">
              <label className="block">
                <span className="mb-0.5 block text-[#6b7280]">از تاریخ:</span>
                <JalaliDateInput
                  value={filter.dateFrom ?? ''}
                  onChange={(e) =>
                    onChange({ ...filter, dateFrom: e.target.value || null })
                  }
                  className="w-full rounded border border-[#e0e0e0] px-2 py-1 text-[12px] focus:border-[#3078ab] focus:outline-none"
                />
                {filter.dateFrom && (
                  <span className="mt-0.5 block text-[10.5px] text-[#3078ab]">
                    {isoToJalali(filter.dateFrom, 'long')}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-0.5 block text-[#6b7280]">تا تاریخ:</span>
                <JalaliDateInput
                  value={filter.dateTo ?? ''}
                  onChange={(e) =>
                    onChange({ ...filter, dateTo: e.target.value || null })
                  }
                  className="w-full rounded border border-[#e0e0e0] px-2 py-1 text-[12px] focus:border-[#3078ab] focus:outline-none"
                />
                {filter.dateTo && (
                  <span className="mt-0.5 block text-[10.5px] text-[#3078ab]">
                    {isoToJalali(filter.dateTo, 'long')}
                  </span>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* 4..9. Content-type toggles */}
        {KIND_TOGGLES.map(({ kind, label, ligature }) => {
          const active = filter.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              title={label}
              aria-label={label}
              aria-pressed={active}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                active
                  ? 'bg-[#3078ab] text-white'
                  : 'text-[#5b5e66] hover:bg-white hover:text-[#3078ab]'
              }`}
            >
              <MzIcon name={ligature} size={14} />
            </button>
          );
        })}

        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              onChange({ ...DEFAULT_STREAM_FILTERS });
              setFallbackPanel(null);
            }}
            title="پاک کردن فیلترها"
            aria-label="پاک کردن فیلترها"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#d9534f] transition-colors hover:bg-white"
          >
            <MzIcon name="close" size={14} />
          </button>
        )}
      </div>

      {hasActiveFilter &&
        totalCount !== undefined &&
        filteredCount !== undefined && (
          <span className="text-[11px] text-[#6b7280]">
            {toPersianDigits(filteredCount)} از {toPersianDigits(totalCount)} مورد
          </span>
        )}
    </div>
  );
}
