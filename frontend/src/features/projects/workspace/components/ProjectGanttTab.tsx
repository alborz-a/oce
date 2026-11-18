import { useMemo, useState } from 'react';
import { MzIcon } from './MzIcon';
import { FolderKanban, Printer, ZoomIn } from 'lucide-react';
import { GanttChart, type GanttActivity, type ViewMode } from '@/shared/ui/Gantt';
import { toPersianDigits } from '@/shared/lib/jalali';
import {
  classifyTaskWorkState,
  getTaskEffectiveProgress,
  isTopicConversationTask,
  mapStatusToBoardLabel,
  type TaskWorkState,
} from '../hooks/useProjectWorkspaceStats';
import type { ProjectTaskItem } from '../types';

export interface ProjectGanttTabProps {
  projectId: string;
  tasks: ProjectTaskItem[];
  onSelectTask?: (task: ProjectTaskItem) => void;
  projectName?: string;
}

export interface GanttTreeRow {
  id: string;
  kind: 'group' | 'task';
  label: string;
  boardKey: string;
  progress: number;
  state?: TaskWorkState;
  taskCount?: number;
  task?: ProjectTaskItem;
}

const GROUP_PREFIX = '__group__:';

const STATE_BAR_COLORS: Record<TaskWorkState, string> = {
  done: '#00b4d8',
  delayed: '#d9534f',
  in_progress: '#3078ab',
  remaining: '#80cbc4',
};

function addDaysIso(isoDate: string, days: number): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function validIsoDate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function resolveTaskGanttDates(
  task: ProjectTaskItem,
  todayIso: string,
): { start: string; end: string; isScheduled: boolean } {
  const explicitStart = validIsoDate(task.start_date);
  const explicitDue = validIsoDate(task.due_date);
  const created = validIsoDate(task.created_at) ?? todayIso;

  let start = explicitStart ?? (explicitDue ? addDaysIso(explicitDue, -3) : created);
  let end = explicitDue ?? addDaysIso(start, 3);

  if (end < start) {
    start = end;
  }

  return {
    start,
    end,
    isScheduled: explicitStart !== null || explicitDue !== null,
  };
}

export function buildGanttTreeAndActivities(
  tasks: readonly ProjectTaskItem[],
  collapsedBoards: ReadonlySet<string>,
  todayIso: string,
): {
  rows: GanttTreeRow[];
  activities: GanttActivity[];
  boardKeys: string[];
  taskById: Map<string, ProjectTaskItem>;
} {
  const groups = new Map<string, ProjectTaskItem[]>();
  const taskById = new Map<string, ProjectTaskItem>();

  for (const task of tasks) {
    taskById.set(task.id, task);
    const rawBoard =
      typeof task.metadata?.mizito_board === 'string'
        ? task.metadata.mizito_board.trim()
        : '';
    const boardKey = rawBoard || mapStatusToBoardLabel(task.status);
    const bucket = groups.get(boardKey);
    if (bucket) bucket.push(task);
    else groups.set(boardKey, [task]);
  }

  const rows: GanttTreeRow[] = [];
  const activities: GanttActivity[] = [];
  const boardKeys: string[] = [];

  for (const [boardKey, groupTasks] of groups.entries()) {
    boardKeys.push(boardKey);

    let minStart = '9999-12-31';
    let maxEnd = '0000-01-01';
    let progressSum = 0;

    const childEntries = groupTasks.map((task) => {
      const dates = resolveTaskGanttDates(task, todayIso);
      const state = classifyTaskWorkState(task, todayIso);
      const progress = state === 'done' ? 100 : getTaskEffectiveProgress(task);
      if (dates.start < minStart) minStart = dates.start;
      if (dates.end > maxEnd) maxEnd = dates.end;
      progressSum += progress;
      return { task, dates, state, progress };
    });

    const groupId = `${GROUP_PREFIX}${boardKey}`;
    const groupProgress =
      childEntries.length > 0 ? Math.round(progressSum / childEntries.length) : 0;

    rows.push({
      id: groupId,
      kind: 'group',
      label: boardKey,
      boardKey,
      progress: groupProgress,
      taskCount: childEntries.length,
    });

    activities.push({
      id: groupId,
      name: boardKey,
      start: minStart === '9999-12-31' ? todayIso : minStart,
      end: maxEnd === '0000-01-01' ? todayIso : maxEnd,
      progress: groupProgress,
      isGroup: true,
      color: '#2b4162',
    });

    if (!collapsedBoards.has(boardKey)) {
      for (const { task, dates, state, progress } of childEntries) {
        rows.push({
          id: task.id,
          kind: 'task',
          label: task.title,
          boardKey,
          progress,
          state,
          task,
        });

        activities.push({
          id: task.id,
          name: task.title,
          start: dates.start,
          end: dates.end,
          progress,
          parentId: groupId,
          isCritical: state === 'delayed' || task.priority === 'urgent',
          color: STATE_BAR_COLORS[state],
        });
      }
    }
  }

  return { rows, activities, boardKeys, taskById };
}

const ZOOM_LABELS: ReadonlyArray<{ mode: ViewMode; label: string }> = [
  { mode: 'day', label: 'روزانه' },
  { mode: 'week', label: 'هفتگی' },
  { mode: 'month', label: 'ماهانه' },
];

export function ProjectGanttTab({
  projectId,
  tasks,
  onSelectTask,
  projectName,
}: ProjectGanttTabProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [onlyScheduled, setOnlyScheduled] = useState(false);
  const [collapsedBoards, setCollapsedBoards] = useState<Set<string>>(() => new Set());

  const workTasks = useMemo(() => {
    const filtered = tasks.filter(
      (t) =>
        !isTopicConversationTask(t) &&
        (!t.project_id || t.project_id === projectId),
    );
    if (!onlyScheduled) return filtered;
    return filtered.filter((t) => resolveTaskGanttDates(t, todayIso).isScheduled);
  }, [tasks, projectId, onlyScheduled, todayIso]);

  const { rows, activities, boardKeys, taskById } = useMemo(
    () => buildGanttTreeAndActivities(workTasks, collapsedBoards, todayIso),
    [workTasks, collapsedBoards, todayIso],
  );

  const toggleBoardCollapse = (boardKey: string) => {
    setCollapsedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(boardKey)) next.delete(boardKey);
      else next.add(boardKey);
      return next;
    });
  };

  const allCollapsed = boardKeys.length > 0 && boardKeys.every((k) => collapsedBoards.has(k));
  const toggleAllBoards = () => {
    if (allCollapsed) {
      setCollapsedBoards(new Set());
    } else {
      setCollapsedBoards(new Set(boardKeys));
    }
  };

  const handleActivityClick = (id: string) => {
    if (id.startsWith(GROUP_PREFIX)) {
      toggleBoardCollapse(id.slice(GROUP_PREFIX.length));
      return;
    }
    const task = taskById.get(id);
    if (task) onSelectTask?.(task);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white"
      data-testid="project-gantt-tab"
    >
      {/* Top Gantt toolbar matching reference ddb37e7005af44c9.png */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] bg-[#f5f6f8] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {projectName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b4162] px-3 py-1 text-[11.5px] font-semibold text-white">
              <FolderKanban size={13} aria-hidden="true" />
              <span>{toPersianDigits(projectName)}</span>
            </span>
          )}

          {/* Scale selector: روزانه / هفتگی / ماهانه */}
          <div className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white p-0.5">
            <span className="inline-flex items-center gap-1 px-2 text-[11.5px] text-[#5b5e66]">
              <ZoomIn size={13} aria-hidden="true" className="text-[#3078ab]" />
              <span>بزرگنمایی:</span>
            </span>
            {ZOOM_LABELS.map(({ mode, label }) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  data-testid={`gantt-zoom-${mode}`}
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    active
                      ? 'bg-[#3078ab] text-white'
                      : 'text-[#4b5563] hover:bg-[#f2f4f7]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-[#4b5563] select-none">
            <input
              type="checkbox"
              checked={onlyScheduled}
              onChange={(e) => setOnlyScheduled(e.target.checked)}
              data-testid="gantt-only-scheduled"
              className="h-3.5 w-3.5 accent-[#3078ab]"
            />
            <span>فقط وظایف زمان‌دار</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {boardKeys.length > 0 && (
            <button
              type="button"
              onClick={toggleAllBoards}
              data-testid="gantt-toggle-all"
              className="rounded-md border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#4b5563] hover:bg-[#f2f4f7]"
            >
              {allCollapsed ? 'باز کردن همه' : 'جمع کردن همه'}
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            aria-label="چاپ گانت پروژه"
            data-testid="gantt-print-button"
            className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#4b5563] hover:bg-[#f2f4f7]"
          >
            <Printer size={13} aria-hidden="true" />
            <span>چاپ</span>
          </button>
        </div>
      </div>

      {/* RTL Split: Collapsible Task Tree on Right + Synchronized SVGGanttChart on Left */}
      {workTasks.length === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center p-8 text-center text-[#909090]"
          data-testid="gantt-empty-state"
        >
          <p className="text-[13px] font-medium text-[#5b5e66]">
            هنوز وظیفه‌ای برای نمایش در گانت پروژه ثبت نشده است
          </p>
        </div>
      ) : (
        <div className="mz-scroll-area flex min-h-0 flex-1 items-start overflow-x-hidden">
          {/* Right Panel in RTL: Collapsible Board/Task Tree */}
          <aside
            className="w-[260px] min-w-[240px] shrink-0 border-e border-[#e5e7eb] bg-white"
            aria-label="درخت وظایف گانت"
            data-testid="gantt-task-tree"
          >
            {/* Header matches GanttChart HEADER_HEIGHT = 48px */}
            <div className="flex h-[48px] items-center justify-between border-b border-[#e5e7eb] bg-[#f5f6f8] px-3">
              <span className="text-[12px] font-semibold text-[#374151]">عنوان وظیفه</span>
              <span className="rounded-full bg-[#e5e7eb] px-2 py-0.5 text-[10.5px] font-medium text-[#4b5563] tabular-nums">
                {toPersianDigits(workTasks.length)}
              </span>
            </div>

            <div>
              {rows.map((row) => {
                if (row.kind === 'group') {
                  const isCollapsed = collapsedBoards.has(row.boardKey);
                  return (
                    <div
                      key={row.id}
                      className="flex h-[40px] items-center justify-between border-b border-[#e5e7eb] bg-[#f9fafb] px-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleBoardCollapse(row.boardKey)}
                        aria-expanded={!isCollapsed}
                        data-testid={`gantt-group-toggle-${row.boardKey}`}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-start text-[12px] font-semibold text-[#1f2937] hover:text-[#3078ab]"
                      >
                        {isCollapsed ? (
                          <MzIcon name="chevron_right" size={14} className="icon-flip-horizontal shrink-0 text-[#6b7280]" />
                        ) : (
                          <MzIcon name="arrow_drop_down" size={14} className="shrink-0 text-[#6b7280]" />
                        )}
                        <span className="truncate">{toPersianDigits(row.label)}</span>
                        <span className="shrink-0 text-[10.5px] font-normal text-[#909090] tabular-nums">
                          ({toPersianDigits(row.taskCount ?? 0)})
                        </span>
                      </button>
                      <span className="shrink-0 text-[10.5px] font-medium text-[#3078ab] tabular-nums">
                        {toPersianDigits(row.progress)}٪
                      </span>
                    </div>
                  );
                }

                const dotColor = STATE_BAR_COLORS[row.state ?? 'remaining'];
                return (
                  <div
                    key={row.id}
                    className="flex h-[40px] items-center justify-between gap-2 border-b border-[#f0f2f5] bg-white ps-6 pe-2.5 hover:bg-[#f5f6f8]"
                  >
                    <button
                      type="button"
                      onClick={() => row.task && onSelectTask?.(row.task)}
                      data-testid={`gantt-tree-task-${row.id}`}
                      title={row.label}
                      className="flex min-w-0 flex-1 items-center gap-2 text-start text-[12px] text-[#374151] hover:text-[#3078ab]"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="truncate">{toPersianDigits(row.label)}</span>
                    </button>
                    <span className="shrink-0 text-[10.5px] text-[#909090] tabular-nums">
                      {toPersianDigits(row.progress)}٪
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Left Panel in RTL: Wrapped SVGGanttChart timeline */}
          <div
            className="min-w-0 flex-1 overflow-x-auto bg-white [&>div>div:first-child]:hidden [&>div]:!h-auto [&>div]:rounded-none [&>div]:border-0 [&>div]:bg-white"
            data-testid="gantt-timeline-pane"
          >
            <GanttChart
              activities={activities}
              viewMode={viewMode}
              onActivityClick={handleActivityClick}
              showDependencies={false}
              showCriticalPath
              todayLine
            />
          </div>
        </div>
      )}
    </div>
  );
}
