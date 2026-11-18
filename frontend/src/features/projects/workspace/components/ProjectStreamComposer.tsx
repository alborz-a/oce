import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AtSign, CalendarPlus, FileUp, Paperclip } from 'lucide-react';
import { MzIcon } from './MzIcon';
import { uploadDocument } from '@/features/documents/api';
import { createMeeting, type MeetingType } from '@/features/meetings/api';
import { createTask, updateTask } from '@/features/tasks/api';
import { toPersianDigits } from '@/shared/lib/jalali';
import { assignableMembers, memberLabel } from '@/shared/lib/assignableMembers';
import { rawFileQuotePreview } from '../lib/rawFileTag';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { JalaliDateInput } from '@/shared/ui/JalaliDateInput';
import { isTopicConversationTask } from '../hooks/useProjectWorkspaceStats';
import type { ProjectTaskItem, StreamItem, StreamQuotedEntity } from '../types';
import type { ProjectMemberSummary } from './ProjectBoardTab';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';

export interface ComposerSendPayload {
  text: string;
  documentIds?: string[];
  mentions?: string[];
  replyToId?: string | null;
  quotedEntity?: StreamQuotedEntity | null;
}

export interface ProjectStreamComposerProps {
  projectId: string;
  currentUser?: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string | null;
  };
  members: ProjectMemberSummary[];
  tasks: ProjectTaskItem[];
  boards?: string[];
  replyTo: StreamItem | null;
  onCancelReply: () => void;
  onSend: (payload: ComposerSendPayload) => Promise<void>;
  onTasksChanged?: () => void;
  onMeetingsChanged?: () => void;
}

const QUICK_EMOJIS = ['👍', '✅', '🙏', '🔥', '👏', '❤️', '📌', '🎉'] as const;

function useNativeModalDialog(
  dialogRef: React.RefObject<HTMLDialogElement>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.setAttribute('closedby', 'any');
    if (open) {
      if (!dialog.open && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [dialogRef, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
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
  }, [dialogRef, onClose]);
}

function buildQuotedEntityFromItem(item: StreamItem): StreamQuotedEntity | null {
  if (item.kind === 'photo' && item.rawPhotos?.[0]) {
    const firstPhoto = item.rawPhotos[0];
    return {
      kind: 'photo',
      id: firstPhoto.id,
      title: firstPhoto.caption || firstPhoto.filename || 'تصویر پروژه',
      subtitle: item.authorName,
      thumbUrl: `/api/v1/documents/photos/${firstPhoto.id}/thumb/`,
    };
  }
  if (item.kind === 'task_activity' && item.rawTaskActivity) {
    return {
      kind: 'task_activity',
      id: item.rawTaskActivity.taskId,
      title: item.rawTaskActivity.taskTitle,
      subtitle: item.rawTaskActivity.reportText || item.rawTaskActivity.actionText,
    };
  }
  if (item.kind === 'document' && item.rawDocument) {
    return {
      kind: 'document',
      id: item.rawDocument.id,
      title: item.rawDocument.name,
      subtitle: item.authorName,
    };
  }
  if (item.kind === 'minutes' && item.rawMeeting) {
    return {
      kind: 'minutes',
      id: item.rawMeeting.meetingId,
      title: item.rawMeeting.title,
      subtitle: item.rawMeeting.date,
    };
  }
  return {
    kind: item.kind,
    id: item.id,
    title: item.text?.slice(0, 80) || item.authorName,
    subtitle: item.authorName,
  };
}

const MOBILE_MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] text-[#374151] hover:bg-[#f5f6f8] disabled:opacity-50';

export function ProjectStreamComposer({
  projectId,
  currentUser,
  members,
  tasks,
  boards = ['برای انجام'],
  replyTo,
  onCancelReply,
  onSend,
  onTasksChanged,
  onMeetingsChanged,
}: ProjectStreamComposerProps) {
  const mentionPopoverId = useId();
  const emojiPopoverId = useId();
  const taskHeadingId = useId();
  const minutesHeadingId = useId();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const taskDialogRef = useRef<HTMLDialogElement>(null);
  const minutesDialogRef = useRef<HTMLDialogElement>(null);
  const emojiTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mentionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const emojiPopoverRef = useRef<HTMLDivElement | null>(null);
  const mentionPopoverRef = useRef<HTMLDivElement | null>(null);

  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackPopover, setFallbackPopover] = useState<'mention' | 'emoji' | null>(null);
  useAnchoredPopover(emojiTriggerRef, emojiPopoverRef, fallbackPopover === 'emoji');
  useAnchoredPopover(mentionTriggerRef, mentionPopoverRef, fallbackPopover === 'mention', 'top');
  const [mentionQuery, setMentionQuery] = useState('');
  const mentionQueryNorm = mentionQuery.trim().toLowerCase();
  const filteredMembers = members.filter((m) => {
    if (!mentionQueryNorm) return true;
    const label = (m.full_name || m.email || '').toLowerCase();
    return label.includes(mentionQueryNorm);
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Quick Task Dialog state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskBoard, setTaskBoard] = useState(boards[0] ?? 'برای انجام');
  const [creatingTask, setCreatingTask] = useState(false);

  // Quick Meeting Minutes Dialog state
  const [minutesModalOpen, setMinutesModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meetingType, setMeetingType] = useState<MeetingType>('progress');
  const [meetingSummary, setMeetingSummary] = useState('');
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const closeTaskDialog = useCallback(() => setTaskModalOpen(false), []);
  const closeMinutesDialog = useCallback(() => setMinutesModalOpen(false), []);

  useNativeModalDialog(taskDialogRef, taskModalOpen, closeTaskDialog);
  useNativeModalDialog(minutesDialogRef, minutesModalOpen, closeMinutesDialog);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      setErrorMsg(null);
      try {
        const uploaded: Array<{ id: string; name: string }> = [];
        for (const file of list) {
          const category = file.type.startsWith('image/') ? 'photo' : 'other';
          const doc = await uploadDocument(projectId, file, category);
          if (doc?.id) {
            uploaded.push({ id: doc.id, name: doc.name || file.name });
          }
        }
        if (uploaded.length > 0) {
          setAttachments((prev) => [...prev, ...uploaded]);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'خطا در آپلود فایل');
      } finally {
        setUploading(false);
      }
    },
    [projectId],
  );

  const handleSend = useCallback(async () => {
    const cleanText = text.trim();
    if ((!cleanText && attachments.length === 0) || sending || uploading) return;

    setSending(true);
    setErrorMsg(null);
    try {
      const replyToChatId = replyTo?.rawChatMessage?.id ?? null;
      const quotedEntity =
        replyTo && !replyToChatId ? buildQuotedEntityFromItem(replyTo) : null;

      await onSend({
        text: cleanText || attachments.map((a) => a.name).join('، '),
        documentIds: attachments.map((a) => a.id),
        mentions: mentions.length > 0 ? mentions : undefined,
        replyToId: replyToChatId,
        quotedEntity,
      });

      setText('');
      setAttachments([]);
      setMentions([]);
      onCancelReply();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ارسال پیام ناموفق بود');
    } finally {
      setSending(false);
    }
  }, [text, attachments, sending, uploading, replyTo, mentions, onSend, onCancelReply]);

  const insertToken = (token: string, mentionedUserId?: string) => {
    setText((prev) => {
      const spacer = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
      return `${prev}${spacer}${token} `;
    });
    if (mentionedUserId) {
      setMentions((prev) =>
        prev.includes(mentionedUserId) ? prev : [...prev, mentionedUserId],
      );
    }
    setFallbackPopover(null);
    textareaRef.current?.focus();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || creatingTask) return;
    setCreatingTask(true);
    try {
      const created = await createTask({
        project_id: projectId,
        title: taskTitle.trim(),
        task_type: 'task',
        due_date: taskDueDate.trim() || undefined,
        responsible_id: taskAssignee.trim() || undefined,
        metadata: { mizito_board: taskBoard.trim() || 'برای انجام' },
      });
      if (created?.id) {
        await updateTask(created.id, { status: 'open' }).catch(() => undefined);
      }
      setTaskTitle('');
      setTaskAssignee('');
      setTaskDueDate('');
      onTasksChanged?.();
      if (taskDialogRef.current?.open) taskDialogRef.current.close();
      else setTaskModalOpen(false);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle.trim() || creatingMeeting) return;
    setCreatingMeeting(true);
    try {
      await createMeeting({
        project_id: projectId,
        title: meetingTitle.trim(),
        meeting_type: meetingType,
        meeting_date: meetingDate,
        status: 'scheduled',
        minutes: meetingSummary.trim() || undefined,
      });
      setMeetingTitle('');
      setMeetingSummary('');
      onMeetingsChanged?.();
      if (minutesDialogRef.current?.open) minutesDialogRef.current.close();
      else setMinutesModalOpen(false);
    } finally {
      setCreatingMeeting(false);
    }
  };

  const mentionableTasks = tasks.filter((t) => !isTopicConversationTask(t)).slice(0, 8);
  const replyPreviewText =
    (replyTo?.text ? rawFileQuotePreview(replyTo.text) : '') ||
    replyTo?.rawTaskActivity?.reportText ||
    replyTo?.rawTaskActivity?.taskTitle ||
    replyTo?.rawDocument?.name ||
    replyTo?.rawPhotos?.[0]?.caption ||
    'پیام';

  return (
    <div
      className={`relative shrink-0 border-t border-[#e5e7eb] bg-white px-3 py-2 ${
        dragActive ? 'ring-2 ring-inset ring-[#3078ab] bg-[#f0f7ff]/60' : ''
      }`}
      data-testid="project-stream-composer"
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragActive) setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragActive(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) {
          void uploadFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Active Reply Bar */}
      {replyTo && (
        <div
          className="mb-2 flex items-center justify-between gap-2 rounded-lg border-s-2 border-[#3078ab] bg-[#f5f6f8] px-3 py-1.5 text-[11.5px]"
          data-testid="composer-reply-preview"
        >
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-[#3078ab]">
              پاسخ به {replyTo.authorName}:
            </span>{' '}
            <span className="truncate text-[#4b5563]">{toPersianDigits(replyPreviewText)}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="لغو پاسخ"
            data-testid="composer-cancel-reply"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#6b7280] hover:bg-[#e5e7eb]"
          >
            <MzIcon name="close" size={13} />
          </button>
        </div>
      )}

      {/* Pending uploaded attachments */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" data-testid="composer-attachments">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-[#f5f6f8] px-2.5 py-0.5 text-[11px] text-[#374151]"
            >
              <Paperclip size={11} className="text-[#3078ab]" />
              <span className="max-w-[160px] truncate">{att.name}</span>
              <button
                type="button"
                aria-label={`حذف ${att.name}`}
                onClick={() =>
                  setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                }
                className="text-[#909090] hover:text-[#d9534f]"
              >
                <MzIcon name="close" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="mb-1.5 text-[11px] text-[#d9534f]">
          {errorMsg}
        </p>
      )}

      {/* Main composer row */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 shrink-0 rounded-full bg-[#cfd8dc] text-[#455a64] shadow-[0_1px_2px_rgba(0,0,0,.18)]">
          <UserAvatar
            url={currentUser?.avatar_url}
            alt={currentUser?.full_name || currentUser?.email || 'کاربر'}
            className="h-7 w-7 rounded-full object-cover"
          />
        </div>

        {/* Capsule input + inner icon controls */}
        <div className="relative flex min-w-0 flex-1 items-center gap-1 rounded-[20px] border border-[#e5e7eb] bg-[#f5f6f8] px-3 py-1 focus-within:border-[#3078ab] focus-within:bg-white">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                e.preventDefault();
                void uploadFiles(files);
              }
            }}
            placeholder="پیام خود را بگذارید..."
            aria-label="پیام خود را بگذارید"
            data-testid="composer-text-input"
            className="max-h-24 min-h-[28px] min-w-0 flex-1 resize-none bg-transparent py-1 text-[12.5px] text-[#1f2937] placeholder:text-[#909090] focus:outline-none"
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            data-testid="composer-file-input"
            onChange={(e) => {
              if (e.target.files?.length) {
                void uploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <div className="relative flex shrink-0 items-center gap-0.5">
            {/* Quick Task & Minutes pills (.project-buttons) */}
            <div className="project-buttons hidden md:inline-flex me-1">
              <button
                type="button"
                onClick={() => setTaskModalOpen(true)}
                data-testid="composer-quick-task-btn"
              >
                + وظیفه
              </button>
              <button
                type="button"
                onClick={() => setMinutesModalOpen(true)}
                data-testid="composer-quick-minutes-btn"
              >
                + صورتجلسه
              </button>
            </div>

            {/* Mobile (< md): one 9-dot menu holding the secondary composer buttons */}
            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="دکمه‌های بیشتر"
                aria-expanded={mobileMenuOpen}
                data-testid="composer-mobile-menu-btn"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#3078ab]"
              >
                <MzIcon name="apps" size={20} />
              </button>
              {mobileMenuOpen && (
                <div
                  role="menu"
                  data-testid="composer-mobile-menu"
                  className="absolute bottom-9 end-0 z-20 flex w-44 flex-col gap-0.5 rounded-lg border border-[#e5e7eb] bg-white p-1.5 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="composer-menu-emoji"
                    className={MOBILE_MENU_ITEM_CLASS}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      emojiTriggerRef.current?.click();
                    }}
                  >
                    <MzIcon name="insert_emoticon" size={14} className="shrink-0" />
                    <span>افزودن ایموجی</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="composer-menu-mention"
                    className={MOBILE_MENU_ITEM_CLASS}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      mentionTriggerRef.current?.click();
                    }}
                  >
                    <AtSign size={14} className="shrink-0" />
                    <span>منشن همکار یا وظیفه</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="composer-menu-attach"
                    disabled={uploading}
                    className={MOBILE_MENU_ITEM_CLASS}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Paperclip size={14} className="shrink-0" />
                    <span>پیوست عکس یا فایل</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="composer-menu-task"
                    className={MOBILE_MENU_ITEM_CLASS}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setTaskModalOpen(true);
                    }}
                  >
                    <MzIcon name="checklist_rtl" size={14} className="shrink-0" />
                    <span>+ وظیفه</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="composer-menu-minutes"
                    className={MOBILE_MENU_ITEM_CLASS}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setMinutesModalOpen(true);
                    }}
                  >
                    <CalendarPlus size={14} className="shrink-0" />
                    <span>+ صورتجلسه</span>
                  </button>
                </div>
              )}
            </div>

            {/* Emoji popover trigger */}
            <button
              type="button"
              ref={(el) => {
                emojiTriggerRef.current = el;
                if (el) el.setAttribute('popovertarget', emojiPopoverId);
              }}
              onClick={() => {
                if (!('popover' in HTMLElement.prototype)) {
                  setFallbackPopover((v) => (v === 'emoji' ? null : 'emoji'));
                }
              }}
              aria-label="افزودن ایموجی"
              data-testid="composer-emoji-btn"
              className="hidden md:inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#3078ab]"
            >
              <MzIcon name="insert_emoticon" size={16} />
            </button>

            <div
              id={emojiPopoverId}
              ref={(el) => {
                emojiPopoverRef.current = el;
                if (el) el.setAttribute('popover', 'auto');
              }}
              className={`rounded-lg border border-[#e5e7eb] bg-white p-2 shadow-lg ${
                fallbackPopover === 'emoji' ? 'block' : ''
              }`}
            >
              <div className="flex items-center gap-1">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => insertToken(em)}
                    className="rounded p-1 text-[16px] hover:bg-[#f2f4f7]"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* @ Mention popover trigger */}
            <button
              type="button"
              ref={(el) => {
                mentionTriggerRef.current = el;
                if (el) el.setAttribute('popovertarget', mentionPopoverId);
              }}
              onClick={() => {
                if (!('popover' in HTMLElement.prototype)) {
                  setFallbackPopover((v) => (v === 'mention' ? null : 'mention'));
                }
              }}
              aria-label="منشن همکار یا وظیفه"
              data-testid="composer-mention-btn"
              className="hidden md:inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#3078ab]"
            >
              <AtSign size={16} />
            </button>

            <div
              id={mentionPopoverId}
              ref={(el) => {
                mentionPopoverRef.current = el;
                if (el) el.setAttribute('popover', 'auto');
              }}
              data-testid="composer-mention-popover"
              className={`max-h-56 w-60 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-white p-2 shadow-lg ${
                fallbackPopover === 'mention' ? 'block' : ''
              }`}
            >
              <input
                type="search"
                dir="rtl"
                value={mentionQuery}
                onChange={(e) => setMentionQuery(e.target.value)}
                placeholder="نام کاربر را وارد نمایید"
                aria-label="جستجوی همکار"
                data-testid="composer-mention-search"
                className="mb-1.5 h-7 w-full rounded border border-[#e5e7eb] bg-[#f5f6f8] px-2 text-[12px] text-[#374151] outline-none focus:border-[#3078ab] focus:bg-white"
              />
              <div className="mb-1 text-[11px] font-bold text-[#5b5e66]">همکاران پروژه</div>
              <ul className="space-y-0.5">
                {filteredMembers.map((m) => {
                  const name = m.full_name || m.email || 'همکار';
                  const checked = mentions.includes(m.user_id);
                  return (
                    <li key={m.user_id}>
                      <button
                        type="button"
                        onClick={() => insertToken(`@${name}`, m.user_id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-start text-[12px] text-[#374151] hover:bg-[#f5f6f8]"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                            checked ? 'border-[#3078ab] bg-[#3078ab] text-white' : 'border-[#c4c9d1] bg-white'
                          }`}
                        >
                          {checked ? <MzIcon name="check" size={10} /> : null}
                        </span>
                        <UserAvatar
                          url={m.avatar_url}
                          alt={name}
                          className="h-5 w-5 shrink-0 rounded-full object-cover"
                        />
                        <span className="truncate">{name}</span>
                        {m.role ? (
                          <span className="ms-auto shrink-0 rounded-full bg-[#eef3f8] px-1.5 text-[10px] text-[#3078ab]">
                            {m.role}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {mentionableTasks.length > 0 && (
                <>
                  <div className="mt-2 mb-1 border-t border-[#f0f2f5] pt-1.5 text-[11px] font-bold text-[#5b5e66]">
                    ارجاع به وظیفه
                  </div>
                  <ul className="space-y-0.5">
                    {mentionableTasks.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => insertToken(`«${t.title}»`)}
                          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-start text-[11.5px] text-[#3078ab] hover:bg-[#f5f6f8]"
                        >
                          <MzIcon name="checklist_rtl" size={12} className="shrink-0" />
                          <span className="truncate">{toPersianDigits(t.title)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* File/Photo attachment button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="پیوست عکس یا فایل"
              data-testid="composer-attach-btn"
              className="hidden md:inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#3078ab] disabled:opacity-50"
            >
              {uploading ? <FileUp size={16} /> : <Paperclip size={16} />}
            </button>

            {/* Send button */}
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={(!text.trim() && attachments.length === 0) || sending || uploading}
              aria-label="ارسال پیام"
              data-testid="composer-send-btn"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#3078ab] text-white hover:brightness-95 disabled:bg-[#d5d8dc] disabled:text-[#909090]"
            >
              <MzIcon name="send" size={20} flipRtl />
            </button>
          </div>
        </div>
      </div>

      {/* Native <dialog> for "+ وظیفه" */}
      <dialog
        ref={taskDialogRef}
        aria-labelledby={taskHeadingId}
        data-testid="composer-task-dialog"
        className="max-w-[440px] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-0 text-[#1f2937] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f5f6f8] px-4 py-3">
          <h2 id={taskHeadingId} className="text-[13.5px] font-bold text-[#1f2937]">
            ایجاد سریع وظیفه در گروه
          </h2>
          <button
            type="button"
            onClick={() =>
              taskDialogRef.current?.open
                ? taskDialogRef.current.close()
                : setTaskModalOpen(false)
            }
            aria-label="بستن"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-[#6b7280] hover:bg-[#e5e7eb]"
          >
            <MzIcon name="close" size={15} />
          </button>
        </div>
        <form onSubmit={(e) => void handleCreateTask(e)} className="space-y-3 p-4">
          <input
            type="text"
            autoFocus
            required
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="عنوان وظیفه..."
            aria-label="عنوان وظیفه"
            data-testid="composer-task-title-input"
            className="h-9 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] focus:border-[#3078ab] focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={taskBoard}
              onChange={(e) => setTaskBoard(e.target.value)}
              aria-label="ستون بورد"
              className="h-8 rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
            >
              {boards.map((b) => (
                <option key={b} value={b}>
                  {toPersianDigits(b)}
                </option>
              ))}
            </select>
            <JalaliDateInput
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              aria-label="تاریخ سررسید"
              className="h-8 rounded-md border border-[#e5e7eb] px-2 text-[12px]"
            />
          </div>
          {members.length > 0 && (
            <select
              value={taskAssignee}
              onChange={(e) => setTaskAssignee(e.target.value)}
              aria-label="مسئول انجام"
              className="h-8 w-full rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
            >
              <option value="">مسئول انجام (اختیاری)</option>
              {assignableMembers(members).map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                taskDialogRef.current?.open
                  ? taskDialogRef.current.close()
                  : setTaskModalOpen(false)
              }
              className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-[12px] text-[#4b5563]"
            >
              لغو
            </button>
            <button
              type="submit"
              disabled={!taskTitle.trim() || creatingTask}
              data-testid="composer-task-submit"
              className="rounded-md bg-[#04c39a] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              ایجاد وظیفه
            </button>
          </div>
        </form>
      </dialog>

      {/* Native <dialog> for "+ صورتجلسه" */}
      <dialog
        ref={minutesDialogRef}
        aria-labelledby={minutesHeadingId}
        data-testid="composer-minutes-dialog"
        className="max-w-[460px] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-0 text-[#1f2937] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f5f6f8] px-4 py-3">
          <h2 id={minutesHeadingId} className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1f2937]">
            <CalendarPlus size={15} className="text-[#3078ab]" />
            <span>ثبت صورتجلسه پروژه</span>
          </h2>
          <button
            type="button"
            onClick={() =>
              minutesDialogRef.current?.open
                ? minutesDialogRef.current.close()
                : setMinutesModalOpen(false)
            }
            aria-label="بستن"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-[#6b7280] hover:bg-[#e5e7eb]"
          >
            <MzIcon name="close" size={15} />
          </button>
        </div>
        <form onSubmit={(e) => void handleCreateMeeting(e)} className="space-y-3 p-4">
          <input
            type="text"
            autoFocus
            required
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="عنوان جلسه / صورتجلسه..."
            aria-label="عنوان جلسه"
            data-testid="composer-minutes-title-input"
            className="h-9 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] focus:border-[#3078ab] focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value as MeetingType)}
              aria-label="نوع جلسه"
              className="h-8 rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
            >
              <option value="progress">پیشرفت کار</option>
              <option value="design">طراحی</option>
              <option value="safety">ایمنی (HSE)</option>
              <option value="subcontractor">پیمانکار</option>
              <option value="kickoff">آغاز پروژه</option>
              <option value="commercial">مالی و بازرگانی</option>
              <option value="closeout">تحویل</option>
            </select>
            <JalaliDateInput
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              aria-label="تاریخ جلسه"
              className="h-8 rounded-md border border-[#e5e7eb] px-2 text-[12px]"
            />
          </div>
          <textarea
            rows={3}
            value={meetingSummary}
            onChange={(e) => setMeetingSummary(e.target.value)}
            placeholder="خلاصه مصوبات و صورتجلسه..."
            aria-label="خلاصه مصوبات"
            className="w-full rounded-md border border-[#e5e7eb] p-2.5 text-[12px] focus:border-[#3078ab] focus:outline-none"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                minutesDialogRef.current?.open
                  ? minutesDialogRef.current.close()
                  : setMinutesModalOpen(false)
              }
              className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-[12px] text-[#4b5563]"
            >
              لغو
            </button>
            <button
              type="submit"
              disabled={!meetingTitle.trim() || creatingMeeting}
              data-testid="composer-minutes-submit"
              className="rounded-md bg-[#3078ab] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              ثبت صورتجلسه
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
