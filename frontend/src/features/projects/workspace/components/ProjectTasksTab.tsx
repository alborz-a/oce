import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MzIcon } from './MzIcon';
import {
  createTask,
  completeTask,
  updateTask,
  type TaskPriority,
} from '@/features/tasks/api';
import { apiGet } from '@/shared/lib/api';
import { formatJalali, toPersianDigits } from '@/shared/lib/jalali';
import { assignableMembers, memberLabel } from '@/shared/lib/assignableMembers';
import {
  getAttachmentCount,
  getChecklistCounts,
  getTaskProgressPercent,
  matchesTaskDueFilters,
  matchesTaskSearch,
} from '../lib/taskListFilters';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { JalaliDateInput } from '@/shared/ui/JalaliDateInput';
import {
  classifyTaskWorkState,
  isTopicConversationTask,
} from '../hooks/useProjectWorkspaceStats';
import type { ProjectTaskItem } from '../types';
import {
  extractMizitoLabels,
  type ProjectMemberSummary,
} from './ProjectBoardTab';

export interface ProjectTasksTabProps {
  projectId: string;
  tasks: ProjectTaskItem[];
  members?: ProjectMemberSummary[];
  onTasksChanged?: () => void;
  onSelectTask?: (task: ProjectTaskItem) => void;
  onOpenFiles?: () => void;
}

export type TasksViewFilter = 'incomplete' | 'all' | 'done' | 'delayed';
export type TasksSortKey = 'default' | 'due_date' | 'priority' | 'title';

interface ProjectFileRowSummary {
  id: string;
  name: string;
  size_bytes?: number;
  kind?: string;
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function ProjectTasksTab({
  projectId,
  tasks,
  members = [],
  onTasksChanged,
  onSelectTask,
  onOpenFiles,
}: ProjectTasksTabProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const filterPopoverId = useId();
  const createHeadingId = useId();
  const createDialogRef = useRef<HTMLDialogElement>(null);

  const [viewFilter, setViewFilter] = useState<TasksViewFilter>('incomplete');
  const [sortKey, setSortKey] = useState<TasksSortKey>('default');
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [hasDueFilter, setHasDueFilter] = useState(false);
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [popoverOpenFallback, setPopoverOpenFallback] = useState(false);

  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);
  const [projectFiles, setProjectFiles] = useState<ProjectFileRowSummary[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newBoard, setNewBoard] = useState('برای انجام');
  const [newWeight, setNewWeight] = useState(1);
  const [creating, setCreating] = useState(false);

  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOptimisticDone({});
  }, [tasks]);

  const membersById = useMemo(() => {
    const map = new Map<string, ProjectMemberSummary>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  // Native <dialog> lifecycle for "+ ایجاد وظیفه"
  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    dialog.setAttribute('closedby', 'any');
    if (createOpen) {
      if (!dialog.open && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [createOpen]);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      setCreateOpen(false);
    };
    dialog.addEventListener('close', handleClose);

    if ('closedBy' in HTMLDialogElement.prototype) {
      return () => dialog.removeEventListener('close', handleClose);
    }

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        dialog.close();
      }
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('pointerup', onUp);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('pointerup', onUp);
    };
  }, []);

  const closeCreateDialog = useCallback(() => {
    const dialog = createDialogRef.current;
    if (dialog?.open) dialog.close();
    else setCreateOpen(false);
  }, []);

  const handleOpenFilesClick = () => {
    if (onOpenFiles) {
      onOpenFiles();
      return;
    }
    const next = !filesDrawerOpen;
    setFilesDrawerOpen(next);
    if (next && projectFiles.length === 0) {
      setLoadingFiles(true);
      apiGet<{ items?: ProjectFileRowSummary[] } | ProjectFileRowSummary[]>(
        `/v1/projects/${projectId}/files/`,
      )
        .then((res) => {
          const items = Array.isArray(res) ? res : res?.items ?? [];
          setProjectFiles(items);
        })
        .catch(() => setProjectFiles([]))
        .finally(() => setLoadingFiles(false));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createTask({
        project_id: projectId,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        task_type: 'task',
        priority: newPriority,
        due_date: newDueDate.trim() || undefined,
        responsible_id: newAssigneeId.trim() || undefined,
        metadata: {
          mizito_board: newBoard.trim() || 'برای انجام',
          weight: Number.isFinite(newWeight) && newWeight > 0 ? newWeight : 1,
        },
      });
      if (created?.id) {
        await updateTask(created.id, { status: 'open' }).catch(() => undefined);
      }
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setNewAssigneeId('');
      setNewWeight(1);
      onTasksChanged?.();
      closeCreateDialog();
    } finally {
      setCreating(false);
    }
  };

  const handleToggleDone = async (task: ProjectTaskItem, isDone: boolean) => {
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

  const filteredAndSorted = useMemo(() => {
    const q = searchText.trim();
    const list = tasks.filter((task) => {
      if (isTopicConversationTask(task)) return false;
      if (task.project_id && task.project_id !== projectId) return false;

      const state = classifyTaskWorkState(task, todayIso);
      const isDone = optimisticDone[task.id] ?? state === 'done';

      if (viewFilter === 'incomplete' && isDone) return false;
      if (viewFilter === 'done' && !isDone) return false;
      if (viewFilter === 'delayed' && (isDone || state !== 'delayed')) return false;

      if (assigneeFilter && task.responsible_id !== assigneeFilter) return false;
      if (priorityFilter && (task.priority ?? 'normal') !== priorityFilter) return false;

      const isOverdue = !isDone && state === 'delayed';
      if (
        !matchesTaskDueFilters(
          task,
          { hasDueOnly: hasDueFilter, overdueOnly: overdueFilter },
          isOverdue,
        )
      ) {
        return false;
      }

      if (q && !matchesTaskSearch(task, q)) return false;
      return true;
    });

    if (sortKey === 'default') return list;
    return [...list].sort((a, b) => {
      if (sortKey === 'title') {
        return a.title.localeCompare(b.title, 'fa');
      }
      if (sortKey === 'due_date') {
        const ad = a.due_date ?? '9999-12-31';
        const bd = b.due_date ?? '9999-12-31';
        return ad.localeCompare(bd);
      }
      const ap = PRIORITY_RANK[(a.priority ?? 'normal').toLowerCase()] ?? 2;
      const bp = PRIORITY_RANK[(b.priority ?? 'normal').toLowerCase()] ?? 2;
      return ap - bp;
    });
  }, [
    tasks,
    projectId,
    todayIso,
    optimisticDone,
    viewFilter,
    assigneeFilter,
    priorityFilter,
    hasDueFilter,
    overdueFilter,
    searchText,
    sortKey,
  ]);

  const { undatedTasks, scheduledTasks, completedTasks } = useMemo(() => {
    const undated: ProjectTaskItem[] = [];
    const scheduled: ProjectTaskItem[] = [];
    const done: ProjectTaskItem[] = [];

    for (const t of filteredAndSorted) {
      const state = classifyTaskWorkState(t, todayIso);
      const isDone = optimisticDone[t.id] ?? state === 'done';
      if (isDone) {
        done.push(t);
      } else if (!t.due_date) {
        undated.push(t);
      } else {
        scheduled.push(t);
      }
    }
    return { undatedTasks: undated, scheduledTasks: scheduled, completedTasks: done };
  }, [filteredAndSorted, todayIso, optimisticDone]);

  const groups: Array<{ key: string; title: string; items: ProjectTaskItem[] }> = [
    {
      key: 'undated',
      title: `وظایف بدون زمان (${toPersianDigits(undatedTasks.length)} مورد)`,
      items: undatedTasks,
    },
    {
      key: 'scheduled',
      title: `وظایف زمان‌دار (${toPersianDigits(scheduledTasks.length)} مورد)`,
      items: scheduledTasks,
    },
    {
      key: 'completed',
      title: `انجام شده (${toPersianDigits(completedTasks.length)} مورد)`,
      items: completedTasks,
    },
  ].filter((g) => g.items.length > 0);

  const hasSubFilter = Boolean(
    searchText.trim() || assigneeFilter || priorityFilter || hasDueFilter || overdueFilter,
  );

  const clearSubFilters = () => {
    setSearchText('');
    setAssigneeFilter('');
    setPriorityFilter('');
    setHasDueFilter(false);
    setOverdueFilter(false);
  };

  const priorityLabelByValue: Record<string, string> = {
    urgent: 'فوری',
    high: 'بالا',
    normal: 'معمولی',
    low: 'کم',
  };
  const assigneeChipLabel = assigneeFilter
    ? (() => {
        const member = assignableMembers(members).find((m) => m.user_id === assigneeFilter);
        return member ? memberLabel(member) : 'مسئول';
      })()
    : '';

  const activeFilterChips: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...(searchText.trim()
      ? [
          {
            key: 'search',
            label: `جستجو: ${searchText.trim()}`,
            onRemove: () => setSearchText(''),
          },
        ]
      : []),
    ...(priorityFilter
      ? [
          {
            key: 'priority',
            label: `اولویت: ${priorityLabelByValue[priorityFilter] ?? priorityFilter}`,
            onRemove: () => setPriorityFilter(''),
          },
        ]
      : []),
    ...(assigneeFilter
      ? [
          {
            key: 'assignee',
            label: `مسئول: ${assigneeChipLabel}`,
            onRemove: () => setAssigneeFilter(''),
          },
        ]
      : []),
    ...(hasDueFilter
      ? [{ key: 'has-due', label: 'دارای زمان', onRemove: () => setHasDueFilter(false) }]
      : []),
    ...(overdueFilter
      ? [{ key: 'overdue', label: 'دارای تاخیر', onRemove: () => setOverdueFilter(false) }]
      : []),
  ];

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white"
      data-testid="project-tasks-tab"
    >
      {/* Top toolbar matching d2c8edb36b1015a0.png */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e5e7eb] bg-[#f5f6f8] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-2.5 py-1 text-[12px] text-[#4b5563]">
            <span>نمایش:</span>
            <select
              value={viewFilter}
              onChange={(e) => setViewFilter(e.target.value as TasksViewFilter)}
              aria-label="نمایش وظایف"
              data-testid="tasks-view-select"
              className="bg-transparent font-semibold text-[#1f2937] focus:outline-none"
            >
              <option value="incomplete">کارهای انجام نشده</option>
              <option value="all">همه کارها</option>
              <option value="done">انجام شده</option>
              <option value="delayed">دارای تاخیر</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            data-testid="tasks-create-button"
            className="inline-flex items-center gap-1 rounded-md bg-[#04c39a] px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-95"
          >
            <MzIcon name="add" size={14} />
            <span>ایجاد وظیفه</span>
          </button>

          <button
            type="button"
            onClick={handleOpenFilesClick}
            data-testid="tasks-files-button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#3078ab]/30 bg-[#3078ab] px-3 py-1.5 text-[12px] font-medium text-white hover:brightness-95"
          >
            <MzIcon name="folder_open" size={14} aria-hidden="true" />
            <span>مشاهده فایل‌ها</span>
          </button>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <button
            type="button"
            ref={(el) => {
              if (el) el.setAttribute('popovertarget', filterPopoverId);
            }}
            onClick={() => {
              if (!('popover' in HTMLElement.prototype)) {
                setPopoverOpenFallback((v) => !v);
              }
            }}
            data-testid="tasks-filter-popover-trigger"
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
              hasSubFilter
                ? 'border-[#3078ab] bg-[#e8f2fa] text-[#3078ab]'
                : 'border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f2f4f7]'
            }`}
          >
            <MzIcon name="filter_list" size={13} />
            <span>فیلتر</span>
          </button>

          {/* Native Popover API filter panel */}
          <div
            id={filterPopoverId}
            ref={(el) => {
              if (el) el.setAttribute('popover', 'auto');
            }}
            data-testid="tasks-filter-popover"
            className={`w-64 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-lg ${
              popoverOpenFallback ? 'block' : ''
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#1f2937]">فیلتر وظایف</span>
                {hasSubFilter && (
                  <button
                    type="button"
                    onClick={clearSubFilters}
                    className="text-[11px] text-[#d9534f] hover:underline"
                  >
                    پاک کردن
                  </button>
                )}
              </div>

              <div className="relative flex items-center">
                <MzIcon name="search" size={13} className="pointer-events-none absolute start-2 text-[#909090]" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="جستجوی وظایف"
                  aria-label="جستجو در وظایف"
                  data-testid="tasks-filter-search"
                  className="h-8 w-full rounded border border-[#e5e7eb] ps-7 pe-2 text-[12px]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-[#5b5e66]">اولویت</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  aria-label="فیلتر اولویت"
                  className="h-8 w-full rounded border border-[#e5e7eb] bg-white px-2 text-[12px]"
                >
                  <option value="">همه اولویت‌ها</option>
                  <option value="urgent">فوری</option>
                  <option value="high">بالا</option>
                  <option value="normal">معمولی</option>
                  <option value="low">کم</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 text-[12px] text-[#1f2937]">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasDueFilter}
                    onChange={(e) => setHasDueFilter(e.target.checked)}
                    data-testid="tasks-filter-has-due"
                  />
                  <span>دارای زمان</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={overdueFilter}
                    onChange={(e) => setOverdueFilter(e.target.checked)}
                    data-testid="tasks-filter-overdue"
                  />
                  <span>دارای تاخیر</span>
                </label>
              </div>

              {members.length > 0 && (
                <div>
                  <label className="mb-1 block text-[11px] text-[#5b5e66]">مسئول</label>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    aria-label="فیلتر مسئول"
                    className="h-8 w-full rounded border border-[#e5e7eb] bg-white px-2 text-[12px]"
                  >
                    <option value="">همه اعضا</option>
                    {assignableMembers(members).map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {memberLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[12px] text-[#4b5563]">
            <MzIcon name="swap_vert" size={13} aria-hidden="true" className="text-[#6b7280]" />
            <span>مرتب‌سازی:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as TasksSortKey)}
              aria-label="مرتب‌سازی وظایف"
              data-testid="tasks-sort-select"
              className="bg-transparent font-medium text-[#1f2937] focus:outline-none"
            >
              <option value="default">پیش‌فرض</option>
              <option value="due_date">تاریخ سررسید</option>
              <option value="priority">اولویت</option>
              <option value="title">عنوان</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            aria-label="چاپ فهرست وظایف"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f2f4f7]"
          >
            <MzIcon name="print" size={14} />
          </button>
        </div>
      </div>

      {/* Inline Project Files Drawer (when toggled without external handler) */}
      {filesDrawerOpen && (
        <section
          className="border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5"
          aria-label="فایل‌های پروژه"
          data-testid="tasks-files-drawer"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#374151]">
              فایل‌های پروژه ({toPersianDigits(projectFiles.length)})
            </span>
            <button
              type="button"
              onClick={() => setFilesDrawerOpen(false)}
              aria-label="بستن فهرست فایل‌ها"
              className="text-[#6b7280] hover:text-[#1f2937]"
            >
              <MzIcon name="close" size={14} />
            </button>
          </div>
          {loadingFiles ? (
            <p className="text-[11.5px] text-[#909090]">در حال بارگذاری فایل‌ها...</p>
          ) : projectFiles.length === 0 ? (
            <p className="text-[11.5px] text-[#909090]">فایلی برای این پروژه یافت نشد</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {projectFiles.slice(0, 12).map((f) => (
                <li
                  key={f.id}
                  className="rounded border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11.5px] text-[#374151]"
                >
                  {toPersianDigits(f.name)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeFilterChips.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 border-b border-[#e5e7eb] bg-white px-3 py-2"
          data-testid="tasks-active-filter-chips"
        >
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              data-testid={`tasks-filter-chip-${chip.key}`}
              className="inline-flex items-center gap-1 rounded-full border border-[#3078ab]/30 bg-[#e8f2fa] px-2 py-0.5 text-[11px] text-[#3078ab]"
            >
              <span>{chip.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearSubFilters}
            data-testid="tasks-filter-chips-clear"
            className="text-[11px] text-[#d9534f] hover:underline"
          >
            پاک کردن
          </button>
        </div>
      )}

      {/* Compact grouped task list */}
      <div className="mz-scroll-area flex-1 p-3 space-y-4">
        {groups.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#909090]">
            وظیفه‌ای مطابق فیلتر انتخاب‌شده یافت نشد
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-label={group.title}>
              <h3 className="mb-2 px-1 text-[12px] font-semibold text-[#5b5e66]">
                {group.title}
              </h3>

              <ul className="divide-y divide-[#f0f2f5] rounded-lg border border-[#e5e7eb] bg-white">
                {group.items.map((task) => {
                  const state = classifyTaskWorkState(task, todayIso);
                  const isDone = optimisticDone[task.id] ?? state === 'done';
                  const isDelayed = !isDone && state === 'delayed';
                  const labels = extractMizitoLabels(task.metadata);
                  const visibleLabels = labels.slice(0, 2);
                  const extraLabelCount = Math.max(0, labels.length - 2);
                  const assignee = task.responsible_id
                    ? membersById.get(task.responsible_id)
                    : undefined;
                  const checklistCounts = getChecklistCounts(task.checklist);
                  const attachmentCount = getAttachmentCount(task);
                  const progressPercent = getTaskProgressPercent(task);

                  return (
                    <li
                      key={task.id}
                      data-testid={`tasks-row-${task.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 hover:bg-[#f5f6f8] transition-colors"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => void handleToggleDone(task, isDone)}
                          aria-pressed={isDone}
                          aria-label={isDone ? 'لغو تکمیل وظیفه' : 'تکمیل وظیفه'}
                          data-testid={`tasks-row-check-${task.id}`}
                          className={`inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isDone
                              ? 'border-[#04c39a] bg-[#04c39a] text-white'
                              : 'border-[#cbd5e1] bg-white text-transparent hover:border-[#04c39a]'
                          }`}
                        >
                          <MzIcon name="check" size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectTask?.(task)}
                          data-testid={`tasks-row-title-${task.id}`}
                          className="flex min-w-0 flex-1 items-center gap-2 text-start"
                        >
                          <span
                            className={`shrink-0 text-[13px] font-semibold ${
                              isDone ? 'text-[#909090] line-through' : 'text-[#1f2937]'
                            }`}
                          >
                            {toPersianDigits(task.title)}
                          </span>
                          {task.description && (
                            <span className="min-w-0 truncate text-[11.5px] text-[#6b7280]">
                              {toPersianDigits(task.description)}
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {visibleLabels.map((lbl) => (
                          <span
                            key={lbl.text}
                            style={{ backgroundColor: lbl.color }}
                            className="rounded px-2 py-0.5 text-[10.5px] font-semibold text-white"
                          >
                            {toPersianDigits(lbl.text)}
                          </span>
                        ))}

                        {extraLabelCount > 0 && (
                          <span
                            data-testid={`tasks-row-more-labels-${task.id}`}
                            className="rounded bg-[#e5e7eb] px-1.5 py-0.5 text-[10.5px] font-medium text-[#4b5563]"
                          >
                            {toPersianDigits(extraLabelCount)} تا بیشتر...
                          </span>
                        )}

                        {checklistCounts.total > 0 && (
                          <span
                            data-testid={`tasks-row-checklist-${task.id}`}
                            className="rounded bg-[#f5f6f8] px-1.5 py-0.5 text-[10.5px] tabular-nums text-[#4b5563]"
                          >
                            {toPersianDigits(checklistCounts.done)}/{toPersianDigits(checklistCounts.total)} چک‌لیست
                          </span>
                        )}

                        {attachmentCount > 0 && (
                          <span
                            data-testid={`tasks-row-attachments-${task.id}`}
                            className="rounded bg-[#f5f6f8] px-1.5 py-0.5 text-[10.5px] tabular-nums text-[#4b5563]"
                          >
                            {toPersianDigits(attachmentCount)} پیوست
                          </span>
                        )}

                        {task.weight != null && (
                          <span
                            data-testid={`tasks-row-weight-${task.id}`}
                            className="rounded bg-[#f5f6f8] px-1.5 py-0.5 text-[10.5px] tabular-nums text-[#4b5563]"
                          >
                            وزن {toPersianDigits(task.weight)}
                          </span>
                        )}

                        {progressPercent !== null && (
                          <span
                            data-testid={`tasks-row-progress-${task.id}`}
                            className="rounded bg-[#e8f2fa] px-1.5 py-0.5 text-[10.5px] tabular-nums text-[#3078ab]"
                          >
                            {toPersianDigits(progressPercent)}٪
                          </span>
                        )}

                        {task.due_date && (
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] tabular-nums ${
                              isDelayed
                                ? 'border-[#d9534f] bg-[#fef2f2] text-[#d9534f]'
                                : 'border-[#e5e7eb] bg-[#f5f6f8] text-[#4b5563]'
                            }`}
                          >
                            <MzIcon name="schedule" size={11} aria-hidden="true" />
                            <span>{formatJalali(task.due_date, 'short')}</span>
                          </span>
                        )}

                        {(assignee || task.assigned_to_name) && (
                          <div
                            title={assignee?.full_name || task.assigned_to_name || ''}
                            className="h-6 w-6 shrink-0 rounded-full bg-[#e5e7eb] text-[#4b5563]"
                          >
                            <UserAvatar
                              url={assignee?.avatar_url}
                              alt={assignee?.full_name || task.assigned_to_name || 'مسئول'}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Native <dialog> for "+ ایجاد وظیفه" */}
      <dialog
        ref={createDialogRef}
        aria-labelledby={createHeadingId}
        data-testid="tasks-create-dialog"
        className="max-w-[480px] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-0 text-[#1f2937] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f5f6f8] px-4 py-3">
          <h2 id={createHeadingId} className="text-[14px] font-bold text-[#1f2937]">
            ایجاد وظیفه جدید
          </h2>
          <button
            type="button"
            onClick={closeCreateDialog}
            aria-label="بستن فرم ایجاد وظیفه"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#e5e7eb]"
          >
            <MzIcon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-3 p-4">
          <div>
            <label
              htmlFor="new-task-title"
              className="mb-1 block text-[11.5px] font-semibold text-[#4b5563]"
            >
              عنوان وظیفه
            </label>
            <input
              id="new-task-title"
              type="text"
              autoFocus
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="عنوان وظیفه را وارد کنید..."
              data-testid="tasks-create-title-input"
              className="h-9 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] focus:border-[#3078ab] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="new-task-desc"
              className="mb-1 block text-[11.5px] font-semibold text-[#4b5563]"
            >
              توضیحات (اختیاری)
            </label>
            <textarea
              id="new-task-desc"
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full rounded-md border border-[#e5e7eb] p-2.5 text-[12px] focus:border-[#3078ab] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="new-task-priority"
                className="mb-1 block text-[11px] text-[#5b5e66]"
              >
                اولویت
              </label>
              <select
                id="new-task-priority"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="h-8 w-full rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
              >
                <option value="low">کم</option>
                <option value="normal">معمولی</option>
                <option value="high">بالا</option>
                <option value="urgent">فوری</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="new-task-due"
                className="mb-1 block text-[11px] text-[#5b5e66]"
              >
                تاریخ سررسید
              </label>
              <JalaliDateInput
                id="new-task-due"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px]"
              />
            </div>

            <div>
              <label
                htmlFor="new-task-board"
                className="mb-1 block text-[11px] text-[#5b5e66]"
              >
                ستون بورد
              </label>
              <input
                id="new-task-board"
                type="text"
                value={newBoard}
                onChange={(e) => setNewBoard(e.target.value)}
                className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px]"
              />
            </div>

            <div>
              <label
                htmlFor="new-task-weight"
                className="mb-1 block text-[11px] text-[#5b5e66]"
              >
                وزن
              </label>
              <input
                id="new-task-weight"
                type="number"
                min={1}
                max={100}
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
                className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px] tabular-nums"
              />
            </div>
          </div>

          {members.length > 0 && (
            <div>
              <label
                htmlFor="new-task-assignee"
                className="mb-1 block text-[11px] text-[#5b5e66]"
              >
                مسئول انجام
              </label>
              <select
                id="new-task-assignee"
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className="h-8 w-full rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
              >
                <option value="">تعیین نشده</option>
                {assignableMembers(members).map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {memberLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeCreateDialog}
              className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-[12px] text-[#4b5563] hover:bg-[#f2f4f7]"
            >
              لغو
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || creating}
              data-testid="tasks-create-submit"
              className="rounded-md bg-[#04c39a] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              ثبت وظیفه
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
