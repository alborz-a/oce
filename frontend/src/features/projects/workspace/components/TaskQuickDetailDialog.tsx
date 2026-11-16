import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  MessageSquarePlus,
  Plus,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  completeTask,
  updateTask,
  type TaskPriority,
  type TaskStatus,
} from '@/features/tasks/api';
import { apiGet, apiPost } from '@/shared/lib/api';
import { formatJalali, toPersianDigits } from '@/shared/lib/jalali';
import {
  getTaskEffectiveProgress,
  getTaskEffectiveWeight,
} from '../hooks/useProjectWorkspaceStats';
import type { ProjectTaskChecklistItem, ProjectTaskItem } from '../types';
import type { ProjectMemberSummary } from './ProjectBoardTab';

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

  const [comments, setComments] = useState<TaskCommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reportText, setReportText] = useState('');
  const [saving, setSaving] = useState(false);
  const [postingReport, setPostingReport] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
                  درصد پیشرفت ({toPersianDigits(progress)}٪)
                </label>
                <input
                  id="task-detail-progress"
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  data-testid="task-detail-progress-input"
                  className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px] tabular-nums"
                />
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
                <input
                  id="task-detail-due"
                  type="date"
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
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Checklist editor */}
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-2.5">
              <div className="mb-2 text-[11.5px] font-semibold text-[#374151]">
                چک‌لیست ({toPersianDigits(checklist.length)})
              </div>
              <ul className="space-y-1">
                {checklist.map((item, idx) => (
                  <li
                    key={item.id ?? `detail-chk-${idx}`}
                    className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-[12px]"
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

              <div className="mt-2 flex items-center gap-1.5">
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
                  aria-label="افزودن مورد به چک‌لیست"
                  className="h-7 flex-1 rounded border border-[#e5e7eb] bg-white px-2 text-[11.5px] focus:border-[#3078ab] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="inline-flex h-7 items-center gap-1 rounded bg-[#e8f2fa] px-2 text-[11px] font-medium text-[#3078ab]"
                >
                  <Plus size={12} />
                  <span>افزودن</span>
                </button>
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
                        {c.author_name || (c.author_id ? membersById.get(c.author_id) : '') || 'همکار'}
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
    </dialog>
  );
}
