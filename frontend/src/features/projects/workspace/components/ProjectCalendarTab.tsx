import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MzIcon } from './MzIcon';
import {
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAY_NAMES,
  dateToJalali,
  gregorianToJalali,
  jalaliToGregorian,
  toPersianDigits,
} from '@/shared/lib/jalali';
import {
  classifyTaskWorkState,
  isTopicConversationTask,
  type TaskWorkState,
} from '../hooks/useProjectWorkspaceStats';
import type { ProjectTaskItem } from '../types';
import { createTask, updateTask } from '@/features/tasks/api';

export interface ProjectCalendarTabProps {
  projectId: string;
  tasks: ProjectTaskItem[];
  onSelectTask?: (task: ProjectTaskItem) => void;
  onTasksChanged?: () => void;
  projectName?: string;
}

export function formatCalendarDayJalali(jy: number, jm: number, jd: number): string {
  const monthName = PERSIAN_MONTH_NAMES[jm - 1] ?? '';
  return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}

export function buildCalendarDayAriaLabel(jy: number, jm: number, jd: number): string {
  return `ایجاد وظیفه برای ${formatCalendarDayJalali(jy, jm, jd)}`;
}

export type CalendarDateField = 'due_date' | 'reminder_or_due' | 'start_date';
export type CalendarStatusFilter = 'all' | TaskWorkState;

export interface JalaliCalendarCell {
  jy: number;
  jm: number;
  jd: number;
  isoDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function jalaliToIsoDate(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${String(gy).padStart(4, '0')}-${pad2(gm)}-${pad2(gd)}`;
}

export function getJalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const { gy, gm, gd } = jalaliToGregorian(jy, 12, 30);
  const check = gregorianToJalali(gy, gm, gd);
  return check.jy === jy && check.jm === 12 && check.jd === 30 ? 30 : 29;
}

export function getJalaliMonthWeekdayOffset(jy: number, jm: number): number {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, 1);
  const utcDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
  // JS getUTCDay: 0=Sun..6=Sat -> Persian week: 0=Shanbeh(Sat)..6=Jomeh(Fri)
  return (utcDay + 1) % 7;
}

export function buildJalaliMonthGrid(
  jy: number,
  jm: number,
  todayIso: string,
): JalaliCalendarCell[] {
  const daysInMonth = getJalaliMonthLength(jy, jm);
  const offset = getJalaliMonthWeekdayOffset(jy, jm);

  const prevMonth = jm === 1 ? 12 : jm - 1;
  const prevYear = jm === 1 ? jy - 1 : jy;
  const prevMonthLen = getJalaliMonthLength(prevYear, prevMonth);

  const nextMonth = jm === 12 ? 1 : jm + 1;
  const nextYear = jm === 12 ? jy + 1 : jy;

  const cells: JalaliCalendarCell[] = [];

  for (let i = offset - 1; i >= 0; i -= 1) {
    const jd = prevMonthLen - i;
    const isoDate = jalaliToIsoDate(prevYear, prevMonth, jd);
    cells.push({
      jy: prevYear,
      jm: prevMonth,
      jd,
      isoDate,
      isCurrentMonth: false,
      isToday: isoDate === todayIso,
    });
  }

  for (let jd = 1; jd <= daysInMonth; jd += 1) {
    const isoDate = jalaliToIsoDate(jy, jm, jd);
    cells.push({
      jy,
      jm,
      jd,
      isoDate,
      isCurrentMonth: true,
      isToday: isoDate === todayIso,
    });
  }

  const remainder = cells.length % 7;
  const trailing = remainder === 0 ? 0 : 7 - remainder;
  for (let jd = 1; jd <= trailing; jd += 1) {
    const isoDate = jalaliToIsoDate(nextYear, nextMonth, jd);
    cells.push({
      jy: nextYear,
      jm: nextMonth,
      jd,
      isoDate,
      isCurrentMonth: false,
      isToday: isoDate === todayIso,
    });
  }

  return cells;
}

export function resolveTaskCalendarIsoDate(
  task: ProjectTaskItem,
  dateField: CalendarDateField,
): string | null {
  const rawReminder =
    typeof task.metadata?.reminder_at === 'string'
      ? task.metadata.reminder_at
      : typeof task.metadata?.remind_at === 'string'
        ? task.metadata.remind_at
        : null;

  let candidate: string | null = null;
  if (dateField === 'start_date') {
    candidate = task.start_date ?? task.due_date ?? null;
  } else if (dateField === 'reminder_or_due') {
    candidate = rawReminder ?? task.due_date ?? task.start_date ?? null;
  } else {
    candidate = task.due_date ?? null;
  }

  if (!candidate || typeof candidate !== 'string') return null;
  const trimmed = candidate.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

const STATE_PILL_STYLES: Record<TaskWorkState, string> = {
  done: 'border-[#04c39a]/40 bg-[#04c39a]/10 text-[#047857]',
  delayed: 'border-[#d9534f]/40 bg-[#d9534f]/10 text-[#b91c1c]',
  in_progress: 'border-[#3078ab]/40 bg-[#3078ab]/10 text-[#1d4ed8]',
  remaining: 'border-[#d5d8dc] bg-[#f5f6f8] text-[#374151]',
};

const STATE_DOT_COLORS: Record<TaskWorkState, string> = {
  done: '#04c39a',
  delayed: '#d9534f',
  in_progress: '#3078ab',
  remaining: '#9ca3af',
};

export function ProjectCalendarTab({
  projectId,
  tasks,
  onSelectTask,
  onTasksChanged,
}: ProjectCalendarTabProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const initialJalali = useMemo(() => dateToJalali(new Date()), []);

  const [viewYear, setViewYear] = useState(initialJalali.jy);
  const [viewMonth, setViewMonth] = useState(initialJalali.jm);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [showFullTitles, setShowFullTitles] = useState(true);
  const [dateField, setDateField] = useState<CalendarDateField>('due_date');
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>('all');
  const [createCell, setCreateCell] = useState<JalaliCalendarCell | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const openCreateForCell = (cell: JalaliCalendarCell) => {
    setNewTitle('');
    setCreateCell(cell);
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateCell(null);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!createCell || !newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createTask({
        project_id: projectId,
        title: newTitle.trim(),
        task_type: 'task',
        priority: 'normal',
        due_date: createCell.isoDate,
        metadata: {
          mizito_board: 'برای انجام',
          weight: 1,
        },
      });
      if (created?.id) {
        await updateTask(created.id, { status: 'open' }).catch(() => undefined);
      }
      setNewTitle('');
      setCreateCell(null);
      onTasksChanged?.();
    } catch {
      // Keep the dialog open so the user can retry.
    } finally {
      setCreating(false);
    }
  };

  const workTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !isTopicConversationTask(t) &&
          (!t.project_id || t.project_id === projectId),
      ),
    [tasks, projectId],
  );

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return workTasks;
    return workTasks.filter((t) => classifyTaskWorkState(t, todayIso) === statusFilter);
  }, [workTasks, statusFilter, todayIso]);

  const { byIsoDate, unscheduledTasks } = useMemo(() => {
    const map = new Map<string, ProjectTaskItem[]>();
    const undated: ProjectTaskItem[] = [];
    for (const task of filteredTasks) {
      const iso = resolveTaskCalendarIsoDate(task, dateField);
      if (!iso) {
        undated.push(task);
        continue;
      }
      const bucket = map.get(iso);
      if (bucket) bucket.push(task);
      else map.set(iso, [task]);
    }
    return { byIsoDate: map, unscheduledTasks: undated };
  }, [filteredTasks, dateField]);

  const cells = useMemo(
    () => buildJalaliMonthGrid(viewYear, viewMonth, todayIso),
    [viewYear, viewMonth, todayIso],
  );

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(initialJalali.jy);
    setViewMonth(initialJalali.jm);
  };

  const monthTitle = `${PERSIAN_MONTH_NAMES[viewMonth - 1] ?? ''} ${toPersianDigits(viewYear)}`;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white"
      data-testid="project-calendar-tab"
    >
      {/* Top control bar matching reference 7f99a7910601d117.png */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] bg-[#f5f6f8] px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[#374151] select-none">
            <input
              type="checkbox"
              role="switch"
              aria-checked={showUnscheduled}
              checked={showUnscheduled}
              onChange={(e) => setShowUnscheduled(e.target.checked)}
              data-testid="calendar-toggle-unscheduled"
              className="h-3.5 w-3.5 accent-[#6ab04c]"
            />
            <span>نمایش وظایف بدون زمان</span>
            {unscheduledTasks.length > 0 && (
              <span className="rounded-full bg-[#e5e7eb] px-1.5 py-0.5 text-[10.5px] text-[#4b5563] tabular-nums">
                {toPersianDigits(unscheduledTasks.length)}
              </span>
            )}
          </label>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[#374151] select-none">
            <input
              type="checkbox"
              role="switch"
              aria-checked={showFullTitles}
              checked={showFullTitles}
              onChange={(e) => setShowFullTitles(e.target.checked)}
              data-testid="calendar-toggle-full-titles"
              className="h-3.5 w-3.5 accent-[#6ab04c]"
            />
            <span>نمایش کامل عناوین</span>
          </label>

          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[11.5px] text-[#4b5563]">
            <MzIcon name="calendar_today" size={13} aria-hidden="true" className="text-[#3078ab]" />
            <span>نمایش بر اساس:</span>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as CalendarDateField)}
              aria-label="نمایش بر اساس"
              data-testid="calendar-date-field-select"
              className="bg-transparent font-medium text-[#1f2937] focus:outline-none"
            >
              <option value="due_date">زمان سررسید</option>
              <option value="reminder_or_due">زمان یادآوری</option>
              <option value="start_date">تاریخ شروع</option>
            </select>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[11.5px] text-[#4b5563]">
            <MzIcon name="filter_list" size={13} className="text-[#6b7280]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CalendarStatusFilter)}
              aria-label="فیلتر نمایش"
              data-testid="calendar-status-filter"
              className="bg-transparent font-medium text-[#1f2937] focus:outline-none"
            >
              <option value="all">فیلتر نمایش: همه</option>
              <option value="remaining">باقیمانده</option>
              <option value="in_progress">در حال پیشرفت</option>
              <option value="delayed">دارای تاخیر</option>
              <option value="done">انجام شده</option>
            </select>
          </div>
        </div>

        {/* Jalali Month Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="ماه قبل"
            data-testid="calendar-prev-month"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f2f4f7]"
          >
            <MzIcon name="chevron_right" size={15} />
          </button>

          <span
            className="min-w-[110px] rounded-md border border-[#e5e7eb] bg-white px-3 py-1 text-center text-[12.5px] font-semibold text-[#1f2937]"
            data-testid="calendar-month-title"
          >
            {monthTitle}
          </span>

          <button
            type="button"
            onClick={goNextMonth}
            aria-label="ماه بعد"
            data-testid="calendar-next-month"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f2f4f7]"
          >
            <MzIcon name="chevron_right" size={15} className="icon-flip-horizontal" />
          </button>

          <button
            type="button"
            onClick={goToday}
            data-testid="calendar-today-button"
            className="rounded-md border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#3078ab] hover:bg-[#e8f2fa]"
          >
            امروز
          </button>
        </div>
      </div>

      {/* Main grid + optional unscheduled drawer */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showUnscheduled && (
          <aside
            className="mz-scroll-area w-[220px] shrink-0 border-e border-[#e5e7eb] bg-[#f5f6f8] p-2.5"
            aria-label="وظایف بدون زمان"
            data-testid="calendar-unscheduled-panel"
          >
            <h3 className="mb-2 text-[12px] font-semibold text-[#374151]">
              وظایف بدون زمان ({toPersianDigits(unscheduledTasks.length)})
            </h3>
            {unscheduledTasks.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-[#909090]">
                وظیفه بدون زمانی وجود ندارد
              </p>
            ) : (
              <ul className="space-y-1.5">
                {unscheduledTasks.map((task) => {
                  const st = classifyTaskWorkState(task, todayIso);
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onSelectTask?.(task)}
                        className={`flex w-full items-start gap-1.5 rounded-md border px-2 py-1.5 text-start text-[11.5px] transition-colors hover:brightness-95 ${STATE_PILL_STYLES[st]}`}
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: STATE_DOT_COLORS[st] }}
                        />
                        <span className={showFullTitles ? 'break-words' : 'truncate'}>
                          {toPersianDigits(task.title)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        )}

        <div className="mz-scroll-area flex min-w-0 flex-1 flex-col">
          {/* 7-column Persian weekday header (شنبه .. جمعه) */}
          <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-[#f9fafb]">
            {PERSIAN_WEEKDAY_NAMES.map((dayName, idx) => (
              <div
                key={dayName}
                className={`border-e border-[#e5e7eb] px-2 py-2 text-center text-[12px] font-semibold last:border-e-0 ${
                  idx === 6 ? 'text-[#d9534f]' : 'text-[#374151]'
                }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Month day cells */}
          <div
            className="grid flex-1 auto-rows-[minmax(108px,1fr)] grid-cols-7"
            data-testid="calendar-week-grid"
          >
            {cells.map((cell) => {
              const dayTasks = byIsoDate.get(cell.isoDate) ?? [];
              return (
                <div
                  key={`${cell.jy}-${cell.jm}-${cell.jd}`}
                  role="button"
                  tabIndex={0}
                  aria-label={buildCalendarDayAriaLabel(cell.jy, cell.jm, cell.jd)}
                  onClick={() => openCreateForCell(cell)}
                  onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openCreateForCell(cell);
                    }
                  }}
                  data-testid={`calendar-cell-${cell.isoDate}`}
                  className={`flex min-w-0 cursor-pointer flex-col border-b border-e border-[#e5e7eb] p-1.5 last:border-e-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3078ab] ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-[#f9fafb] text-[#9ca3af]'
                  } ${cell.isToday ? 'ring-1 ring-inset ring-[#3078ab]/40 bg-[#f0f7ff]/40' : ''}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11.5px] font-semibold tabular-nums ${
                        cell.isToday
                          ? 'bg-[#3078ab] text-white'
                          : cell.isCurrentMonth
                            ? 'text-[#374151]'
                            : 'text-[#9ca3af]'
                      }`}
                    >
                      {toPersianDigits(cell.jd)}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-[#909090] tabular-nums">
                        {toPersianDigits(dayTasks.length)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayTasks.map((task) => {
                      const st = classifyTaskWorkState(task, todayIso);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask?.(task);
                          }}
                          data-testid={`calendar-task-${task.id}`}
                          className={`flex w-full items-start gap-1 rounded border px-1.5 py-0.5 text-start text-[11px] leading-snug transition-colors hover:brightness-95 ${STATE_PILL_STYLES[st]}`}
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: STATE_DOT_COLORS[st] }}
                          />
                          <span className={showFullTitles ? 'break-words' : 'truncate'}>
                            {toPersianDigits(task.title)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {createCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          data-testid="calendar-create-backdrop"
          onClick={closeCreate}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-create-heading"
            data-testid="calendar-create-dialog"
            className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white text-[#1f2937] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f5f6f8] px-4 py-3">
              <h2 id="calendar-create-heading" className="text-[14px] font-bold text-[#1f2937]">
                ایجاد وظیفه جدید
              </h2>
              <button
                type="button"
                onClick={closeCreate}
                aria-label="بستن فرم ایجاد وظیفه"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#e5e7eb]"
              >
                <MzIcon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-3 p-4">
              <div>
                <label
                  htmlFor="calendar-create-title"
                  className="mb-1 block text-[11.5px] font-semibold text-[#4b5563]"
                >
                  عنوان وظیفه
                </label>
                <input
                  id="calendar-create-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  autoFocus
                  data-testid="calendar-create-title"
                  className="w-full rounded-md border border-[#d5d8dc] px-2.5 py-1.5 text-[12.5px] focus:border-[#3078ab] focus:outline-none"
                />
              </div>
              <div data-testid="calendar-create-due">
                <span className="mb-1 block text-[11.5px] font-semibold text-[#4b5563]">
                  زمان سررسید
                </span>
                <span className="text-[12.5px] text-[#1f2937] tabular-nums">
                  {formatCalendarDayJalali(createCell.jy, createCell.jm, createCell.jd)}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeCreate}
                  className="rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] text-[#4b5563] hover:bg-[#f2f4f7]"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  data-testid="calendar-create-submit"
                  className="rounded-md bg-[#3078ab] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {creating ? 'در حال ذخیره…' : 'ذخیره وظیفه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
