import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Plus,
  Printer,
  Send,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  completeTask,
  deleteTask,
  updateTask,
  type TaskPriority,
  type TaskStatus,
} from '@/features/tasks/api';
import { apiGet, apiPost } from '@/shared/lib/api';
import { useConfirm } from '@/shared/hooks/useConfirm';
import { ConfirmDialog } from '@/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { formatJalali, toPersianDigits } from '@/shared/lib/jalali';
import { assignableMembers, memberLabel } from '@/shared/lib/assignableMembers';
import {
  getTaskEffectiveProgress,
  getTaskEffectiveWeight,
} from '../hooks/useProjectWorkspaceStats';
import type { ProjectTaskChecklistItem, ProjectTaskItem } from '../types';
import type { ProjectMemberSummary } from './ProjectBoardTab';
import { JalaliDateInput } from '@/shared/ui/JalaliDateInput';
import { useFloatingPosition } from '@/shared/ui/floatingPosition';
import {
  DEFAULT_REMINDER_HOUR,
  TASK_LABEL_CHIP_CLASSES,
  TASK_LABEL_COLORS,
  TASK_LABEL_SWATCH_CLASSES,
  collectProjectLabels,
  computeReminderIso,
  createTaskLabel,
  parseRemindAt,
  parseTaskLabels,
  reminderIsoFromDate,
  type TaskLabel,
  type TaskLabelColor,
} from '../lib/taskLabelsAndReminder';
import { displayName } from '../lib/importerAuthor';

export interface TaskQuickDetailDialogProps {
  projectId: string;
  task: ProjectTaskItem | null;
  open: boolean;
  members?: ProjectMemberSummary[];
  onClose: () => void;
  onUpdated?: () => void;
}

interface TaskCommentItem {
  id: string;
  author_id?: string;
  author_name?: string;
  text: string;
  created_at: string;
}

function normalizeCommentsPayload(raw: unknown): TaskCommentItem[] {
  if (Array.isArray(raw)) return raw as TaskCommentItem[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: TaskCommentItem[] }).items;
  }
  return [];
}

function checklistText(item: ProjectTaskChecklistItem): string {
  return (item.text ?? item.title ?? '').trim();
}

function checklistDone(item: ProjectTaskChecklistItem): boolean {
  return Boolean(item.completed ?? item.done);
}

type ReminderRowKey = 'today' | 'tomorrow' | 'dayAfter';

const REMINDER_ROWS: ReadonlyArray<{ key: ReminderRowKey; label: string; offset: number }> = [
  { key: 'today', label: 'امروز', offset: 0 },
  { key: 'tomorrow', label: 'فردا', offset: 1 },
  { key: 'dayAfter', label: 'پس‌فردا', offset: 2 },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);

const HIDDEN_POPOVER_STYLE = { position: 'fixed', top: 0, left: 0, visibility: 'hidden' } as const;

function hourLabel(hour: number): string {
  return toPersianDigits(`${String(hour).padStart(2, '0')}:00`);
}

function formatReminderLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatJalali(d, 'short')} ${hourLabel(d.getHours())}`;
}

export function TaskQuickDetailDialog({
  projectId: _projectId,
  task,
  open,
  members = [],
  onClose,
  onUpdated,
}: TaskQuickDetailDialogProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('open');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [progress, setProgress] = useState<number>(0);
  const [weight, setWeight] = useState<number>(1);
  const [dueDate, setDueDate] = useState<string>('');
  const [responsibleId, setResponsibleId] = useState<string>('');
  const [boardName, setBoardName] = useState<string>('برای انجام');
  const [checklist, setChecklist] = useState<Array<{ id: string | null; text: string; completed: boolean }>>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [remindAt, setRemindAt] = useState<string | null>(null);
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelFilter, setLabelFilter] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<TaskLabelColor>('blue');
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderHours, setReminderHours] = useState<Record<ReminderRowKey, number>>({
    today: DEFAULT_REMINDER_HOUR,
    tomorrow: DEFAULT_REMINDER_HOUR,
    dayAfter: DEFAULT_REMINDER_HOUR,
  });
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [customReminderHour, setCustomReminderHour] = useState<number>(DEFAULT_REMINDER_HOUR);
  const labelTriggerRef = useRef<HTMLButtonElement>(null);
  const labelPopRef = useRef<HTMLDivElement>(null);
  const reminderTriggerRef = useRef<HTMLButtonElement>(null);
  const reminderPopRef = useRef<HTMLDivElement>(null);
  const labelPopStyle = useFloatingPosition(labelOpen, labelTriggerRef, labelPopRef, 'bottom');
  const reminderPopStyle = useFloatingPosition(reminderOpen, reminderTriggerRef, reminderPopRef, 'bottom');

  const [comments, setComments] = useState<TaskCommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reportText, setReportText] = useState('');
  const [saving, setSaving] = useState(false);
  const [postingReport, setPostingReport] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { confirm, ...confirmProps } = useConfirm();

  // Chosen labels first so their color wins over the cached copy of the same label.
  const availableLabels = collectProjectLabels([
    { metadata: { labels } },
    ...(queryClient.getQueryData<ProjectTaskItem[]>(['project-workspace-tasks', _projectId]) ?? []),
  ]);
  const labelFilterKey = labelFilter.trim().toLowerCase();
  const shownLabels = availableLabels.filter(
    (l) => !labelFilterKey || l.name.toLowerCase().includes(labelFilterKey),
  );

  const isLabelChosen = (id: string) => labels.some((l) => l.id === id);

  const toggleLabel = (label: TaskLabel) => {
    setLabels((prev) =>
      prev.some((l) => l.id === label.id)
        ? prev.filter((l) => l.id !== label.id)
        : [...prev, label],
    );
  };

  const handleCreateLabel = () => {
    const created = createTaskLabel(newLabelName, newLabelColor);
    if (!created) return;
    setLabels((prev) => (prev.some((l) => l.id === created.id) ? prev : [...prev, created]));
    setNewLabelName('');
    setCreatingLabel(false);
  };

  const applyReminder = (iso: string | null) => {
    setRemindAt(iso);
    setReminderOpen(false);
  };

  const membersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.user_id, m.full_name || m.email || 'همکار');
    }
    return map;
  }, [members]);

  // Hydrate draft state whenever task changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    const s = (task.status ?? 'open').trim().toLowerCase();
    setStatus(
      s === 'draft' || s === 'open' || s === 'in_progress' || s === 'completed'
        ? s
        : s === 'done'
          ? 'completed'
          : 'open',
    );
    const p = (task.priority ?? 'normal').trim().toLowerCase();
    setPriority(
      p === 'low' || p === 'normal' || p === 'high' || p === 'urgent' ? p : 'normal',
    );
    setProgress(getTaskEffectiveProgress(task));
    setWeight(getTaskEffectiveWeight(task));
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setResponsibleId(task.responsible_id ?? '');
    setLabels(parseTaskLabels(task.metadata?.labels));
    setRemindAt(parseRemindAt(task.metadata?.remind_at));
    setBoardName(
      typeof task.metadata?.mizito_board === 'string' && task.metadata.mizito_board.trim()
        ? task.metadata.mizito_board.trim()
        : 'برای انجام',
    );
    setChecklist(
      (task.checklist ?? []).map((item) => ({
        id: item.id ?? null,
        text: checklistText(item),
        completed: checklistDone(item),
      })),
    );
    setNewCheckItem('');
    setReportText('');
    setErrorMsg(null);
  }, [task]);

  // Load task comments/reports when opened
  useEffect(() => {
    if (!open || !task) return;
    let active = true;
    setLoadingComments(true);
    apiGet<unknown>(
      `/v1/collaboration/comments/?entity_type=task&entity_id=${encodeURIComponent(task.id)}`,
    )
      .then((res) => {
        if (active) setComments(normalizeCommentsPayload(res));
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoadingComments(false);
      });
    return () => {
      active = false;
    };
  }, [open, task]);

  // Native <dialog> modal lifecycle + closedby="any" pointerdown/pointerup fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.setAttribute('closedby', 'any');

    if (open && task) {
      if (!dialog.open && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, task]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    if ('closedBy' in HTMLDialogElement.prototype) {
      return () => {
        dialog.removeEventListener('close', handleClose);
      };
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
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        dialog.close();
      }
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [onClose]);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    } else {
      onClose();
    }
  }, [onClose]);

  const handlePrint = () => {
    setShowActionsMenu(false);
    const escape = (value: string) =>
      value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
    const responsible = (members ?? []).find((m) => m.user_id === responsibleId);
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) {
      setErrorMsg('پنجره چاپ باز نشد. مرورگر را بررسی کنید.');
      return;
    }
    const checklistHtml = checklist
      .filter((c) => c.text.trim().length > 0)
      .map((c) => `<li>${c.completed ? '☑' : '☐'} ${escape(c.text.trim())}</li>`)
      .join('');
    win.document.title = escape(title.trim() || 'وظیفه');
    win.document.body.setAttribute('dir', 'rtl');
    win.document.body.innerHTML = `
      <h1>${escape(title.trim())}</h1>
      <p><strong>وضعیت:</strong> ${escape(status)}</p>
      <p><strong>اولویت:</strong> ${escape(priority)}</p>
      <p><strong>مسئول:</strong> ${escape(responsible ? memberLabel(responsible) : '—')}</p>
      <p><strong>مهلت:</strong> ${escape(dueDate || '—')}</p>
      <p><strong>توضیحات:</strong> ${escape(description.trim() || '—')}</p>
      <h2>چک‌لیست</h2>
      <ul>${checklistHtml || '<li>—</li>'}</ul>`;
    win.focus();
    win.print();
  };

  const handleDelete = async () => {
    setShowActionsMenu(false);
    if (!task || deleting) return;
    const ok = await confirm({
      title: 'حذف وظیفه؟',
      message: 'این وظیفه حذف می‌شود و قابل بازگشت نیست.',
      confirmLabel: 'حذف',
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await deleteTask(task.id);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onUpdated?.();
      requestClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در حذف وظیفه');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddChecklistItem = () => {
    const clean = newCheckItem.trim();
    if (!clean) return;
    setChecklist((prev) => [...prev, { id: null, text: clean, completed: false }]);
    setNewCheckItem('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const cleanWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
      const cleanProgress = Math.max(0, Math.min(100, Math.round(progress)));
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        due_date: dueDate.trim() || null,
        responsible_id: responsibleId.trim() || null,
        checklist: checklist.filter((c) => c.text.trim().length > 0),
        metadata: {
          ...(task.metadata ?? {}),
          mizito_board: boardName.trim() || 'برای انجام',
          weight: cleanWeight,
          progress: cleanProgress,
          labels,
          remind_at: remindAt,
        },
      });
      onUpdated?.();
      requestClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ذخیره تغییرات وظیفه');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickComplete = async () => {
    if (!task || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await completeTask(task.id);
      onUpdated?.();
      requestClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در تکمیل وظیفه');
    } finally {
      setSaving(false);
    }
  };

  const handlePostReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reportText.trim();
    if (!task || !clean || postingReport) return;
    setPostingReport(true);
    setErrorMsg(null);
    try {
      const created = await apiPost<TaskCommentItem>('/v1/collaboration/comments/', {
        entity_type: 'task',
        entity_id: task.id,
        text: clean,
        comment_type: 'comment',
        metadata: { is_report: true },
      });
      setComments((prev) => [...prev, created]);
      setReportText('');
      onUpdated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ارسال گزارش جدید');
    } finally {
      setPostingReport(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      data-testid="task-quick-detail-dialog"
      className="mizito-dialog max-w-[560px] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-0 text-[#1f2937] shadow-xl"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-[#f5f6f8] px-4 py-3">
        <h2 id={headingId} className="text-[14px] font-bold text-[#1f2937]">
          جزئیات و گزارش وظیفه
        </h2>
        <div className="flex items-center gap-1">
          {task && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActionsMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showActionsMenu}
                aria-label="گزینه‌های وظیفه"
                data-testid="task-detail-actions-button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#1f2937]"
              >
                <MoreHorizontal size={16} />
              </button>
              {showActionsMenu && (
                <div
                  role="menu"
                  data-testid="task-detail-actions-menu"
                  className="absolute end-0 top-full z-30 mt-2 w-44 rounded-xl border border-[#e5e7eb] bg-white p-1.5 shadow-lg"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={handlePrint}
                    data-testid="task-detail-print-item"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-[#374151] hover:bg-[#f5f6f8]"
                  >
                    <Printer size={15} />
                    چاپ
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    data-testid="task-detail-delete-item"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    حذف
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={requestClose}
            aria-label="بستن پنجره جزئیات"
            data-testid="task-detail-close-button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#1f2937]"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {task && (
        <div className="mz-scroll-area flex-1 space-y-4 p-4">
          <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
            <div>
              <label
                htmlFor="task-detail-title"
                className="mb-1 block text-[11.5px] font-semibold text-[#4b5563]"
              >
                عنوان وظیفه
              </label>
              <input
                id="task-detail-title"
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="task-detail-title-input"
                className="h-9 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] font-medium text-[#1f2937] focus:border-[#3078ab] focus:outline-none"
              />
            </div>

            <div className="space-y-2" data-testid="task-detail-meta-toolbar">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  ref={labelTriggerRef}
                  type="button"
                  onClick={() => setLabelOpen((v) => !v)}
                  aria-expanded={labelOpen}
                  data-testid="task-detail-labels-trigger"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e7eb] px-2.5 text-[12px] text-[#374151] hover:bg-[#f3f4f6]"
                >
                  <Tag size={14} />
                  برچسب
                </button>
                <button
                  ref={reminderTriggerRef}
                  type="button"
                  onClick={() => setReminderOpen((v) => !v)}
                  aria-expanded={reminderOpen}
                  data-testid="task-detail-reminder-trigger"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e7eb] px-2.5 text-[12px] text-[#374151] hover:bg-[#f3f4f6]"
                >
                  <Bell size={14} />
                  یادآوری
                </button>
              </div>

              {(labels.length > 0 || remindAt) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {labels.map((l) => (
                    <span
                      key={l.id}
                      data-testid="task-detail-label-chip"
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TASK_LABEL_CHIP_CLASSES[l.color]}`}
                    >
                      {l.name}
                    </span>
                  ))}
                  {remindAt && (
                    <span
                      data-testid="task-detail-reminder-chip"
                      className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] px-2 py-0.5 text-[11px] text-[#374151]"
                    >
                      <Bell size={11} />
                      {formatReminderLabel(remindAt)}
                      <button
                        type="button"
                        onClick={() => setRemindAt(null)}
                        aria-label="حذف یادآوری"
                        className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-[#e5e7eb]"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {labelOpen && (
                <div
                  ref={labelPopRef}
                  role="dialog"
                  aria-label="برچسب‌ها"
                  data-testid="task-detail-labels-popover"
                  style={labelPopStyle ?? HIDDEN_POPOVER_STYLE}
                  className="w-64 rounded-lg border border-[#e5e7eb] bg-white p-2 text-[12px] shadow-lg"
                >
                  <input
                    type="text"
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    placeholder="فیلتر برچسب"
                    aria-label="فیلتر برچسب"
                    className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px] focus:border-[#3078ab] focus:outline-none"
                  />
                  <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
                    {shownLabels.map((l) => (
                      <li key={l.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#f3f4f6]">
                          <input
                            type="checkbox"
                            checked={isLabelChosen(l.id)}
                            onChange={() => toggleLabel(l)}
                          />
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TASK_LABEL_CHIP_CLASSES[l.color]}`}
                          >
                            {l.name}
                          </span>
                        </label>
                      </li>
                    ))}
                    {shownLabels.length === 0 && (
                      <li className="px-1.5 py-1 text-[#6b7280]">برچسبی یافت نشد</li>
                    )}
                  </ul>
                  <div className="mt-2 border-t border-[#e5e7eb] pt-2">
                    <button
                      type="button"
                      onClick={() => setCreatingLabel((v) => !v)}
                      className="text-[12px] font-medium text-[#3078ab]"
                    >
                      + ایجاد برچسب جدید
                    </button>
                    {creatingLabel && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={newLabelName}
                          onChange={(e) => setNewLabelName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCreateLabel();
                            }
                          }}
                          placeholder="نام برچسب"
                          aria-label="نام برچسب جدید"
                          className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px] focus:border-[#3078ab] focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5">
                          {TASK_LABEL_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewLabelColor(c)}
                              aria-label={`رنگ ${c}`}
                              aria-pressed={newLabelColor === c}
                              className={`h-5 w-5 rounded-full ${TASK_LABEL_SWATCH_CLASSES[c]} ${newLabelColor === c ? 'ring-2 ring-[#3078ab] ring-offset-1' : ''}`}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={handleCreateLabel}
                            className="ms-auto rounded-md bg-[#3078ab] px-2.5 py-1 text-[12px] text-white"
                          >
                            ایجاد
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {reminderOpen && (
                <div
                  ref={reminderPopRef}
                  role="dialog"
                  aria-label="یادآوری"
                  data-testid="task-detail-reminder-popover"
                  style={reminderPopStyle ?? HIDDEN_POPOVER_STYLE}
                  className="w-72 rounded-lg border border-[#e5e7eb] bg-white p-3 text-[12px] shadow-lg"
                >
                  <ul className="space-y-2">
                    {REMINDER_ROWS.map((row) => (
                      <li key={row.key} className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#1f2937]">{row.label}</span>
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`ساعت ${row.label}`}
                            value={reminderHours[row.key]}
                            onChange={(e) =>
                              setReminderHours((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))
                            }
                            className="h-7 rounded-md border border-[#e5e7eb] bg-white px-1 text-[12px]"
                          >
                            {HOUR_OPTIONS.map((h) => (
                              <option key={h} value={h}>
                                {hourLabel(h)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => applyReminder(computeReminderIso(row.offset, reminderHours[row.key]))}
                            className="h-7 rounded-md border border-[#e5e7eb] px-2 hover:bg-[#f3f4f6]"
                          >
                            تنظیم
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 space-y-2 border-t border-[#e5e7eb] pt-3">
                    <p className="font-medium text-[#1f2937]">انتخاب تاریخ و زمان</p>
                    <div className="flex items-center gap-1.5">
                      <JalaliDateInput
                        id="task-detail-reminder-date"
                        value={customReminderDate}
                        onChange={(e) => setCustomReminderDate(e.target.value)}
                        className="h-8 flex-1 rounded-md border border-[#e5e7eb] px-2 text-[12px]"
                      />
                      <select
                        aria-label="ساعت یادآوری"
                        value={customReminderHour}
                        onChange={(e) => setCustomReminderHour(Number(e.target.value))}
                        className="h-8 rounded-md border border-[#e5e7eb] bg-white px-1 text-[12px]"
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {hourLabel(h)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={!customReminderDate}
                      onClick={() => {
                        const iso = reminderIsoFromDate(customReminderDate, customReminderHour);
                        if (iso) applyReminder(iso);
                      }}
                      className="h-8 w-full rounded-md bg-[#3078ab] text-[12px] text-white disabled:opacity-40"
                    >
                      تنظیم یادآوری
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3">
                    <button
                      type="button"
                      onClick={() => applyReminder(null)}
                      disabled={!remindAt}
                      data-testid="task-detail-reminder-clear"
                      className="text-[12px] text-[#b91c1c] disabled:opacity-40"
                    >
                      پاک کردن یادآوری
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderOpen(false)}
                      className="text-[12px] text-[#6b7280]"
                    >
                      بستن
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="task-detail-desc"
                className="mb-1 block text-[11.5px] font-semibold text-[#4b5563]"
              >
                توضیحات
              </label>
              <textarea
                id="task-detail-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-[#e5e7eb] p-2.5 text-[12px] text-[#374151] focus:border-[#3078ab] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="task-detail-status"
                  className="mb-1 block text-[11px] font-medium text-[#5b5e66]"
                >
                  وضعیت
                </label>
                <select
                  id="task-detail-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="h-8 w-full rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
                >
                  <option value="draft">پیش‌نویس</option>
                  <option value="open">برای انجام</option>
                  <option value="in_progress">در حال پیشرفت</option>
                  <option value="completed">انجام شده</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-detail-priority"
                  className="mb-1 block text-[11px] font-medium text-[#5b5e66]"
                >
                  اولویت
                </label>
                <select
                  id="task-detail-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
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
                  htmlFor="task-detail-board"
                  className="mb-1 block text-[11px] font-medium text-[#5b5e66]"
                >
                  ستون بورد
                </label>
                <input
                  id="task-detail-board"
                  type="text"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px]"
                />
              </div>

              <div>
                <label
                  htmlFor="task-detail-progress"
                  className="mb-1 block text-[11px] font-medium text-[#5b5e66]"
                >
                  درصد پیشرفت
                </label>
                <div className="flex items-center gap-2">
                  <div
                    role="progressbar"
                    aria-label="نوار درصد پیشرفت"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    data-testid="task-detail-progress-bar"
                    className="relative h-5 flex-1 overflow-hidden rounded bg-[#e5e7eb]"
                  >
                    <div
                      className="h-full bg-[#04c39a] transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10.5px] font-semibold tabular-nums text-[#1f2937]">
                      {toPersianDigits(progress)}٪
                    </span>
                  </div>
                  <input
                    id="task-detail-progress"
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    data-testid="task-detail-progress-input"
                    aria-label="ویرایش درصد پیشرفت"
                    className="h-8 w-16 shrink-0 rounded-md border border-[#e5e7eb] px-2 text-[12px] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="task-detail-weight"
                  className="mb-1 block text-[11px] font-medium text-[#5b5e66]"
                >
                  وزن وظیفه
                </label>
                <input
                  id="task-detail-weight"
                  type="number"
                  min={1}
                  max={100}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  data-testid="task-detail-weight-input"
                  className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px] tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="task-detail-due"
                  className="mb-1 block text-[11px] font-medium text-[#5b5e66]"
                >
                  مهلت {dueDate ? `(${formatJalali(dueDate, 'short')})` : ''}
                </label>
                <JalaliDateInput
                  id="task-detail-due"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px]"
                />
              </div>
            </div>

            {members.length > 0 && (
              <div>
                <label
                  htmlFor="task-detail-assignee"
                  className="mb-1 block text-[11px] font-medium text-[#5b5e66]"
                >
                  مسئول انجام
                </label>
                <select
                  id="task-detail-assignee"
                  value={responsibleId}
                  onChange={(e) => setResponsibleId(e.target.value)}
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

            {/* Checklist editor */}
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-2.5">
              <div className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold text-[#374151]">
                <span>چک‌لیست</span>
                <span
                  data-testid="task-detail-checklist-count"
                  className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#e8f2fa] px-1.5 text-[10.5px] font-semibold tabular-nums text-[#3078ab]"
                >
                  {toPersianDigits(checklist.length)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {checklist.map((item, idx) => (
                  <li
                    key={item.id ?? `detail-chk-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[12px]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setChecklist((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, completed: !row.completed } : row,
                          ),
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
                    >
                      {item.completed ? (
                        <CheckSquare size={14} className="shrink-0 text-[#04c39a]" />
                      ) : (
                        <Square size={14} className="shrink-0 text-[#9ca3af]" />
                      )}
                      <span className={item.completed ? 'text-[#909090] line-through' : ''}>
                        {toPersianDigits(item.text)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="حذف مورد چک‌لیست"
                      onClick={() =>
                        setChecklist((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-[#9ca3af] hover:text-[#d9534f]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-dashed border-[#d1d5db] bg-white px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  aria-label="افزودن مورد به چک‌لیست"
                  data-testid="task-detail-checklist-add-row"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#3078ab] hover:bg-[#e8f2fa]"
                >
                  <Plus size={14} />
                </button>
                <input
                  type="text"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="افزودن مورد به چک‌لیست..."
                  aria-label="متن مورد جدید چک‌لیست"
                  className="h-6 min-w-0 flex-1 bg-transparent px-1 text-[12px] focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <p role="alert" className="text-[11.5px] text-[#d9534f]">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleQuickComplete()}
                disabled={saving || status === 'completed'}
                data-testid="task-detail-complete-button"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#04c39a] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                <Check size={14} aria-hidden="true" />
                <span>تکمیل وظیفه</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={requestClose}
                  className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-[12px] text-[#4b5563] hover:bg-[#f2f4f7]"
                >
                  بستن
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || saving}
                  data-testid="task-detail-save-button"
                  className="rounded-md bg-[#3078ab] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </div>
          </form>

          {/* Comments / گزارش جدید section */}
          <section className="border-t border-[#e5e7eb] pt-3" aria-label="گزارش‌های وظیفه">
            <h3 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-[#374151]">
              <MessageSquarePlus size={14} className="text-[#3078ab]" />
              <span>گزارش جدید و نظرات</span>
            </h3>

            {loadingComments ? (
              <p className="py-2 text-[11.5px] text-[#909090]">در حال بارگذاری گزارش‌ها...</p>
            ) : comments.length === 0 ? (
              <p className="py-1.5 text-[11.5px] text-[#909090]">
                هنوز گزارشی ثبت نشده است
              </p>
            ) : (
              <ul className="mb-3 max-h-40 space-y-1.5 overflow-y-auto">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-[#f0f2f5] bg-[#f5f6f8] px-2.5 py-2 text-[12px]"
                  >
                    <div className="mb-0.5 flex items-center justify-between text-[10.5px] text-[#909090]">
                      <span className="font-semibold text-[#4b5563]">
                        {displayName(c.author_name || (c.author_id ? membersById.get(c.author_id) : '') || 'همکار', c.author_id)}
                      </span>
                      <span>{formatJalali(c.created_at, 'short')}</span>
                    </div>
                    <p className="text-[#1f2937]">{toPersianDigits(c.text)}</p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={(e) => void handlePostReport(e)} className="flex items-center gap-2">
              <input
                type="text"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="متن گزارش جدید را بنویسید..."
                aria-label="متن گزارش جدید"
                data-testid="task-detail-report-input"
                className="h-8 flex-1 rounded-full border border-[#e5e7eb] bg-[#f5f6f8] px-3 text-[12px] text-[#1f2937] focus:border-[#3078ab] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!reportText.trim() || postingReport}
                data-testid="task-detail-report-submit"
                className="inline-flex h-8 items-center gap-1 rounded-full bg-[#3078ab] px-3 text-[11.5px] font-semibold text-white disabled:opacity-50"
              >
                <Send size={13} aria-hidden="true" />
                <span>ثبت گزارش</span>
              </button>
            </form>
          </section>
        </div>
      )}
      <ConfirmDialog {...confirmProps} />
    </dialog>
  );
}
