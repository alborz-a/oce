import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MzIcon } from './MzIcon';
import {
  completeTask,
  createTask,
  updateTask,
  type TaskStatus,
} from '@/features/tasks/api';
import { formatJalali, toPersianDigits } from '@/shared/lib/jalali';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import {
  classifyTaskWorkState,
  isTopicConversationTask,
  mapStatusToBoardLabel,
} from '../hooks/useProjectWorkspaceStats';
import type {
  ProjectTaskChecklistItem,
  ProjectTaskItem,
  WorkspaceMember,
} from '../types';

export type ProjectMemberSummary = Pick<WorkspaceMember, 'user_id' | 'full_name'> &
  Partial<WorkspaceMember>;

export interface ProjectBoardTabProps {
  projectId: string;
  tasks: ProjectTaskItem[];
  members?: ProjectMemberSummary[];
  focusedBoardKey?: string | null;
  onTasksChanged?: () => void;
  onSelectTask?: (task: ProjectTaskItem) => void;
}

const DEFAULT_BOARD_NAME = 'برای انجام';

const LABEL_PALETTE = ['#04c39a', '#3078ab', '#ba68c8', '#ff8c7e', '#ff88b0'] as const;

function boardColumnsStorageKey(projectId: string): string {
  return `mz_board_columns_v1_${projectId}`;
}

function readStoredBoardColumns(projectId: string): string[] {
  try {
    const raw = window.localStorage.getItem(boardColumnsStorageKey(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  } catch {
    return [];
  }
}

function writeStoredBoardColumns(projectId: string, cols: readonly string[]): void {
  try {
    window.localStorage.setItem(boardColumnsStorageKey(projectId), JSON.stringify([...cols]));
  } catch {
    // ignore storage errors
  }
}

export function resolveTaskBoardColumn(task: ProjectTaskItem): string {
  const raw =
    typeof task.metadata?.mizito_board === 'string'
      ? task.metadata.mizito_board.trim()
      : '';
  return raw || mapStatusToBoardLabel(task.status);
}

export function mapBoardLabelToTaskStatus(
  boardName: string,
  fallbackStatus: string = 'open',
): TaskStatus {
  const normalized = boardName.trim();
  if (normalized === 'انجام شده') return 'completed';
  if (normalized === 'در حال انجام') return 'in_progress';
  if (normalized === DEFAULT_BOARD_NAME) return 'open';
  const cur = fallbackStatus.trim().toLowerCase();
  if (cur === 'draft' || cur === 'open' || cur === 'in_progress' || cur === 'completed') {
    return cur;
  }
  return 'open';
}

export interface NormalizedBoardLabel {
  text: string;
  color: string;
}

function hashLabelColor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length] ?? '#3078ab';
}

export function extractMizitoLabels(metadata?: Record<string, unknown>): NormalizedBoardLabel[] {
  const raw = metadata?.mizito_labels;
  if (!Array.isArray(raw)) return [];
  const out: NormalizedBoardLabel[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      const text = item.trim();
      out.push({ text, color: hashLabelColor(text) });
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const text =
        typeof rec.name === 'string'
          ? rec.name.trim()
          : typeof rec.label === 'string'
            ? rec.label.trim()
            : typeof rec.title === 'string'
              ? rec.title.trim()
              : '';
      if (!text) continue;
      const color =
        typeof rec.color === 'string' && rec.color.trim()
          ? rec.color.trim()
          : hashLabelColor(text);
      out.push({ text, color });
    }
  }
  return out;
}

function checklistItemText(item: ProjectTaskChecklistItem): string {
  return (item.text ?? item.title ?? '').trim();
}

function checklistItemDone(item: ProjectTaskChecklistItem): boolean {
  return Boolean(item.completed ?? item.done);
}

export function ProjectBoardTab({
  projectId,
  tasks,
  members = [],
  focusedBoardKey = null,
  onTasksChanged,
  onSelectTask,
}: ProjectBoardTabProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [customColumns, setCustomColumns] = useState<string[]>(() =>
    typeof window !== 'undefined' ? readStoredBoardColumns(projectId) : [],
  );
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  const [quickAddBoard, setQuickAddBoard] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hideDoneCards, setHideDoneCards] = useState(false);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, string>>({});
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({});
  const [optimisticChecklists, setOptimisticChecklists] = useState<
    Record<string, ProjectTaskChecklistItem[]>
  >({});

  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    setCustomColumns(readStoredBoardColumns(projectId));
    setOptimisticMoves({});
    setOptimisticDone({});
    setOptimisticChecklists({});
  }, [projectId]);

  // Clear optimistic overrides once authoritative tasks refresh
  useEffect(() => {
    setOptimisticMoves({});
    setOptimisticDone({});
    setOptimisticChecklists({});
  }, [tasks]);

  const membersById = useMemo(() => {
    const map = new Map<string, ProjectMemberSummary>();
    for (const m of members) {
      map.set(m.user_id, m);
    }
    return map;
  }, [members]);

  const workTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !isTopicConversationTask(t) &&
          (!t.project_id || t.project_id === projectId),
      ),
    [tasks, projectId],
  );

  const { columns, tasksByColumn } = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const pushCol = (name: string) => {
      const clean = name.trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      ordered.push(clean);
    };

    pushCol(DEFAULT_BOARD_NAME);

    const grouped = new Map<string, ProjectTaskItem[]>();
    for (const task of workTasks) {
      const effectiveBoard = optimisticMoves[task.id] ?? resolveTaskBoardColumn(task);
      pushCol(effectiveBoard);
      const bucket = grouped.get(effectiveBoard);
      if (bucket) bucket.push(task);
      else grouped.set(effectiveBoard, [task]);
    }

    for (const custom of customColumns) {
      pushCol(custom);
    }

    return { columns: ordered, tasksByColumn: grouped };
  }, [workTasks, customColumns, optimisticMoves]);

  useEffect(() => {
    if (!focusedBoardKey) return;
    const target = columnRefs.current.get(focusedBoardKey);
    target?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focusedBoardKey, columns]);

  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newListName.trim();
    if (!clean) return;
    if (!columns.includes(clean)) {
      const next = [...customColumns, clean];
      setCustomColumns(next);
      writeStoredBoardColumns(projectId, next);
    }
    setNewListName('');
    setAddingList(false);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent, boardName: string) => {
    e.preventDefault();
    const cleanTitle = quickAddTitle.trim();
    if (!cleanTitle || submitting) return;
    setSubmitting(true);
    try {
      const created = await createTask({
        project_id: projectId,
        title: cleanTitle,
        task_type: 'task',
        metadata: { mizito_board: boardName },
      });
      const desiredStatus = mapBoardLabelToTaskStatus(boardName);
      if (created?.id && desiredStatus !== 'draft' && created.status !== desiredStatus) {
        await updateTask(created.id, { status: desiredStatus });
      }
      setQuickAddTitle('');
      setQuickAddBoard(null);
      onTasksChanged?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveTask = useCallback(
    async (task: ProjectTaskItem, targetColumn: string) => {
      const currentCol = optimisticMoves[task.id] ?? resolveTaskBoardColumn(task);
      if (currentCol === targetColumn) return;

      setOptimisticMoves((prev) => ({ ...prev, [task.id]: targetColumn }));
      try {
        await updateTask(task.id, {
          status: mapBoardLabelToTaskStatus(targetColumn, task.status),
          metadata: {
            ...(task.metadata ?? {}),
            mizito_board: targetColumn,
          },
        });
        onTasksChanged?.();
      } catch {
        setOptimisticMoves((prev) => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });
      }
    },
    [optimisticMoves, onTasksChanged],
  );

  const handleToggleComplete = async (task: ProjectTaskItem, isDone: boolean) => {
    setOptimisticDone((prev) => ({ ...prev, [task.id]: !isDone }));
    try {
      if (isDone) {
        await updateTask(task.id, { status: 'open' });
      } else {
        await completeTask(task.id);
      }
      onTasksChanged?.();
    } catch {
      setOptimisticDone((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }
  };

  const handleToggleChecklistItem = async (
    task: ProjectTaskItem,
    items: ProjectTaskChecklistItem[],
    index: number,
  ) => {
    const nextItems = items.map((item, idx) => {
      const nextCompleted = idx === index ? !checklistItemDone(item) : checklistItemDone(item);
      return {
        id: item.id ?? null,
        text: checklistItemText(item) || 'مورد',
        completed: nextCompleted,
      };
    });

    setOptimisticChecklists((prev) => ({ ...prev, [task.id]: nextItems }));
    try {
      await updateTask(task.id, { checklist: nextItems });
      onTasksChanged?.();
    } catch {
      setOptimisticChecklists((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[#f5f6f8]"
      data-testid="project-board-tab"
    >
      {/* Top board toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] bg-white px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-[#374151]">
            ستون‌های بورد ({toPersianDigits(columns.length)})
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-[#4b5563] select-none">
            <input
              type="checkbox"
              checked={hideDoneCards}
              onChange={(e) => setHideDoneCards(e.target.checked)}
              data-testid="board-hide-done-toggle"
              className="h-3.5 w-3.5 accent-mz-project"
            />
            <span>مخفی کردن کارهای انجام‌شده</span>
          </label>
        </div>

        <span className="text-[11.5px] text-[#909090] tabular-nums">
          کل وظایف: {toPersianDigits(workTasks.length)}
        </span>
      </div>

      {/* Horizontal RTL Kanban lane strip */}
      <div className="mz-scroll-area flex min-h-0 flex-1 flex-row items-start gap-3 overflow-x-auto p-3">
        {columns.map((colName) => {
          const allColTasks = tasksByColumn.get(colName) ?? [];
          const doneCount = allColTasks.filter((t) => {
            const override = optimisticDone[t.id];
            if (override !== undefined) return override;
            return classifyTaskWorkState(t, todayIso) === 'done';
          }).length;
          const totalCount = allColTasks.length;
          const donePct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
          const remainingPct = totalCount > 0 ? 100 - donePct : 100;

          const visibleTasks = hideDoneCards
            ? allColTasks.filter((t) => {
                const override = optimisticDone[t.id];
                if (override !== undefined) return !override;
                return classifyTaskWorkState(t, todayIso) !== 'done';
              })
            : allColTasks;

          const isDropTarget = dragOverCol === colName;

          return (
            <section
              key={colName}
              ref={(el) => {
                if (el) columnRefs.current.set(colName, el);
                else columnRefs.current.delete(colName);
              }}
              aria-label={`ستون ${colName}`}
              data-testid={`board-column-${colName}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverCol !== colName) setDragOverCol(colName);
              }}
              onDragLeave={() => {
                if (dragOverCol === colName) setDragOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCol(null);
                const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                setDraggedTaskId(null);
                if (!taskId) return;
                const task = workTasks.find((t) => t.id === taskId);
                if (task) void handleMoveTask(task, colName);
              }}
              className={`flex max-h-full w-[290px] shrink-0 flex-col rounded-lg border bg-white transition-shadow ${
                isDropTarget
                  ? 'border-mz-task ring-2 ring-mz-task/30'
                  : 'border-[#e5e7eb]'
              }`}
            >
              {/* Column Header (name + 3-dot menu) + thin progress bar + inline add trigger */}
              <div className="shrink-0 rounded-t-lg border-b border-[#f0f2f5] bg-white px-3 pb-2.5 pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="truncate text-[13px] font-bold text-[#1f2937]">
                    {toPersianDigits(colName)} ({toPersianDigits(totalCount)})
                  </h3>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {colName === DEFAULT_BOARD_NAME && (
                      <span className="text-[10.5px] text-[#9ca3af]">پیش‌فرض</span>
                    )}
                    <MzIcon name="more_horiz" size={16} className="text-[#6b7280]" />
                  </div>
                </div>

                {/* Thin progress bar: % done (#00b4d8) / % remaining (#d5d8dc) */}
                <div
                  className="flex h-3 w-full overflow-hidden rounded-full bg-[#d5d8dc]"
                  data-testid={`board-column-progress-${colName}`}
                >
                  {donePct > 0 && (
                    <div
                      style={{ width: `${donePct}%` }}
                      className="flex items-center justify-center bg-[#00b4d8] text-[9px] font-semibold text-white tabular-nums"
                    >
                      {donePct >= 14 ? `${toPersianDigits(donePct)}٪` : null}
                    </div>
                  )}
                  {remainingPct > 0 && (
                    <div
                      style={{ width: `${remainingPct}%` }}
                      className="flex items-center justify-center bg-[#d5d8dc] text-[9px] font-semibold text-[#374151] tabular-nums"
                    >
                      {remainingPct >= 14 ? `${toPersianDigits(remainingPct)}٪` : null}
                    </div>
                  )}
                </div>

                {quickAddBoard === colName ? (
                  <form
                    onSubmit={(e) => void handleQuickAddSubmit(e, colName)}
                    className="mt-2 space-y-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={quickAddTitle}
                      onChange={(e) => setQuickAddTitle(e.target.value)}
                      placeholder="عنوان وظیفه جدید..."
                      aria-label="عنوان وظیفه جدید"
                      data-testid={`board-quick-add-input-${colName}`}
                      className="h-8 w-full rounded-md border border-mz-project px-2.5 text-[12px] text-[#1f2937] focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="submit"
                        disabled={!quickAddTitle.trim() || submitting}
                        data-testid={`board-quick-add-submit-${colName}`}
                        className="rounded bg-mz-task px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        افزودن
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddBoard(null);
                          setQuickAddTitle('');
                        }}
                        className="rounded px-2 py-1 text-[11px] text-[#6b7280] hover:bg-[#f2f4f7]"
                      >
                        لغو
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddBoard(colName);
                      setQuickAddTitle('');
                    }}
                    data-testid={`board-add-task-${colName}`}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-[#d5d8dc] bg-white py-1.5 text-[11.5px] font-medium text-[#5b5e66] hover:bg-[#f5f6f8]"
                  >
                    <MzIcon name="add" size={13} />
                    <span>وظیفه جدید</span>
                  </button>
                )}
              </div>

              {/* Column Cards */}
              <div className="mz-scroll-area flex-1 space-y-2 p-2">
                {visibleTasks.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-[#909090]">
                    کار فعالی در این ستون نیست
                  </p>
                ) : (
                  visibleTasks.map((task) => {
                    const effectiveState = classifyTaskWorkState(task, todayIso);
                    const isDone = optimisticDone[task.id] ?? effectiveState === 'done';
                    const isDelayed = !isDone && effectiveState === 'delayed';
                    const labels = extractMizitoLabels(task.metadata);
                    const checklist = optimisticChecklists[task.id] ?? task.checklist ?? [];
                    const assignee = task.responsible_id
                      ? membersById.get(task.responsible_id)
                      : undefined;

                    return (
                      <article
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedTaskId(task.id);
                          e.dataTransfer.setData('text/plain', task.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDragOverCol(null);
                        }}
                        data-testid={`board-card-${task.id}`}
                        className={`rounded-lg border p-2.5 shadow-xs transition-colors ${
                          isDelayed
                            ? 'border-[#d9534f]/60 border-s-[3px] border-s-[#d9534f] bg-[#fffafa]'
                            : 'border-[#e5e7eb] border-s-[3px] border-s-mz-task bg-white hover:shadow-sm'
                        }`}
                      >
                        {/* Top row: check + title + avatar */}
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleComplete(task, isDone)}
                            aria-pressed={isDone}
                            aria-label={isDone ? 'لغو تکمیل وظیفه' : 'تکمیل وظیفه'}
                            data-testid={`board-card-complete-${task.id}`}
                            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              isDone
                                ? 'border-mz-task bg-white text-mz-task'
                                : 'border-[#cbd5e1] bg-white text-transparent hover:border-mz-task'
                            }`}
                          >
                            <MzIcon name="check" size={10} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectTask?.(task)}
                            data-testid={`board-card-title-${task.id}`}
                            className={`min-w-0 flex-1 text-start text-[12.5px] font-bold leading-snug hover:text-mz-project ${
                              isDone ? 'text-[#909090] line-through' : 'text-[#1f2937]'
                            }`}
                          >
                            {toPersianDigits(task.title)}
                          </button>

                          {(assignee || task.assigned_to_name) && (
                            <div
                              title={assignee?.full_name || task.assigned_to_name || ''}
                              className="h-5 w-5 shrink-0 rounded-full bg-[#e5e7eb] text-[#4b5563]"
                            >
                              <UserAvatar
                                url={assignee?.avatar_url}
                                alt={assignee?.full_name || task.assigned_to_name || 'مسئول'}
                                className="h-5 w-5 rounded-full object-cover"
                              />
                            </div>
                          )}
                        </div>

                        {/* Description snippet */}
                        {task.description && (
                          <p className="mt-1.5 line-clamp-2 text-[11px] text-[#5b5e66]">
                            {toPersianDigits(task.description)}
                          </p>
                        )}

                        {/* Due date & Mizito label chips */}
                        {(task.due_date || labels.length > 0) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {task.due_date && (
                              <span
                                data-testid={`board-card-due-${task.id}`}
                                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums ${
                                  isDelayed
                                    ? 'border-[#d9534f] bg-[#fef2f2] text-[#d9534f]'
                                    : 'border-[#e5e7eb] bg-[#f5f6f8] text-[#4b5563]'
                                }`}
                              >
                                <MzIcon name="schedule" size={11} aria-hidden="true" />
                                <span>مهلت: {formatJalali(task.due_date, 'short')}</span>
                              </span>
                            )}

                            {labels.map((lbl) => (
                              <span
                                key={lbl.text}
                                style={{ backgroundColor: `${lbl.color}26`, color: lbl.color }}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              >
                                {toPersianDigits(lbl.text)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Inline Checklist */}
                        {checklist.length > 0 && (
                          <ul
                            className="mt-2 divide-y divide-[#f0f2f5] overflow-hidden rounded-md border border-[#e5e7eb] bg-white"
                            data-testid={`board-card-checklist-${task.id}`}
                          >
                            {checklist.map((item, idx) => {
                              const checked = checklistItemDone(item);
                              const text = checklistItemText(item);
                              return (
                                <li key={item.id ?? `${task.id}-chk-${idx}`}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleToggleChecklistItem(task, checklist, idx)
                                    }
                                    data-testid={`board-card-checkitem-${task.id}-${idx}`}
                                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-start text-[11px] text-[#374151] hover:text-mz-project"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                                        checked
                                          ? 'border-mz-task text-mz-task'
                                          : 'border-[#cbd5e1] text-transparent'
                                      }`}
                                    >
                                      <MzIcon name="check" size={9} />
                                    </span>
                                    <span
                                      className={`truncate ${
                                        checked ? 'text-[#909090] line-through' : ''
                                      }`}
                                    >
                                      {toPersianDigits(text)}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {/* Accessible Move-to-Column selector */}
                        {columns.length > 1 && (
                          <div className="mt-2 flex items-center justify-end gap-1 border-t border-[#f0f2f5] pt-1.5">
                            <MzIcon name="swap_horiz"
                              size={11}
                              aria-hidden="true"
                              className="text-[#909090]"
                            />
                            <select
                              aria-label={`انتقال ${task.title} به ستون`}
                              value={colName}
                              onChange={(e) => void handleMoveTask(task, e.target.value)}
                              data-testid={`board-card-move-${task.id}`}
                              className="rounded border border-[#e5e7eb] bg-[#f5f6f8] px-1.5 py-0.5 text-[10.5px] text-[#4b5563] focus:border-mz-project focus:outline-none"
                            >
                              {columns.map((target) => (
                                <option key={target} value={target}>
                                  {toPersianDigits(target)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}

        {/* Add New List Column (+ افزودن لیست جدید) */}
        <div className="w-[250px] shrink-0">
          {addingList ? (
            <form
              onSubmit={handleCreateColumn}
              className="rounded-lg border border-mz-project bg-white p-2.5 space-y-2"
            >
              <input
                type="text"
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="نام لیست جدید..."
                aria-label="نام لیست جدید"
                data-testid="board-new-list-input"
                className="h-8 w-full rounded-md border border-[#e5e7eb] px-2.5 text-[12px] text-[#1f2937] focus:border-mz-project focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={!newListName.trim()}
                  data-testid="board-new-list-submit"
                  className="rounded bg-mz-project px-3 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50"
                >
                  ایجاد لیست
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingList(false);
                    setNewListName('');
                  }}
                  aria-label="بستن"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-[#6b7280] hover:bg-[#f2f4f7]"
                >
                  <MzIcon name="close" size={14} />
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingList(true)}
              data-testid="board-add-list-button"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#cbd5e1] bg-white/80 px-3 py-2.5 text-[12.5px] font-medium text-[#5b5e66] hover:border-mz-project hover:bg-white hover:text-mz-project"
            >
              <MzIcon name="add" size={15} />
              <span>افزودن لیست جدید</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
