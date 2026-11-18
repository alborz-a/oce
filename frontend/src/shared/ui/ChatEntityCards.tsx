// frontend/src/shared/ui/ChatEntityCards.tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MzIcon } from '@/features/projects/workspace/components/MzIcon';
import clsx from 'clsx';
import { apiGet, type Page } from '@/shared/lib/api';
import { parseChatEntityMarkers } from '@/shared/lib/parseChatEntityMarkers';
import { toPersianDigits } from '@/shared/lib/jalali';
import type { Task } from '@/features/tasks/api';

function renderMentions(text: string): React.ReactNode {
  return text.split(/(@\w[\w.]*)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-oe-blue">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function InlineTaskCard({ title, projectId }: { title: string; projectId?: string }) {
  const navigate = useNavigate();

  const { data: match } = useQuery({
    queryKey: ['chat-task-lookup', projectId ?? 'any', title],
    queryFn: async () => {
      if (!projectId) return null;
      const qs = new URLSearchParams({ project_id: projectId, search: title.slice(0, 120), limit: '10' });
      const page = await apiGet<Page<Task>>(`/v1/tasks/?${qs.toString()}`);
      return page.items.find((item) => item.title.trim() === title.trim()) ?? page.items[0] ?? null;
    },
    enabled: !!projectId && !!title,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const isDone = match?.status === 'completed';
  const targetUrl = projectId
    ? match
      ? `/projects/${projectId}/tasks?id=${encodeURIComponent(match.id)}`
      : `/projects/${projectId}/tasks`
    : match
      ? `/tasks?id=${encodeURIComponent(match.id)}`
      : '/tasks';

  return (
    <button
      type="button"
      onClick={() => navigate(targetUrl)}
      dir="rtl"
      className={clsx(
        'my-1.5 flex w-full max-w-[380px] items-start gap-2.5 rounded-lg border border-[#e0e0e0] border-r-4 p-3 text-start shadow-sm transition-all hover:shadow-md',
        isDone ? 'border-r-[#689f38] bg-[#dcf7bd]/70' : 'border-r-[#0f9d58] bg-white hover:bg-[#f9fbfa]',
      )}
      data-testid="chat-inline-task-card"
    >
      {isDone ? (
        <MzIcon name="done" size={20} color="#689f38" className="mt-0.5 shrink-0" />
      ) : (
        <MzIcon name="check_box_outline_blank" size={20} color="#0f9d58" className="mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className={clsx('text-[13px] font-semibold leading-snug', isDone ? 'line-through text-black/45' : 'text-[#222]')}>
          {toPersianDigits(title)}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#777]">
          <span className="font-medium text-[#0f9d58]">وظیفه</span>
          {match?.assigned_to_name && <span>• {match.assigned_to_name}</span>}
          {match?.due_date && <span>• مهلت: {toPersianDigits(match.due_date)}</span>}
          {!match && <span>• کلیک برای مشاهده در کارها</span>}
        </div>
      </div>
    </button>
  );
}

function InlineMinuteCard({ subject, projectId }: { subject: string; projectId?: string }) {
  const navigate = useNavigate();
  const targetUrl = projectId ? `/projects/${projectId}/meetings` : '/meetings';

  return (
    <button
      type="button"
      onClick={() => navigate(targetUrl)}
      dir="rtl"
      className="my-1.5 flex w-full max-w-[380px] items-center gap-2.5 rounded-lg border border-[#e0e0e0] border-r-4 border-r-[#009688] bg-white p-3 text-start shadow-sm hover:shadow-md transition-all"
      data-testid="chat-inline-minute-card"
    >
      <MzIcon name="assignment" size={20} color="#009688" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[#4caf50] truncate">{toPersianDigits(subject)}</div>
        <div className="text-[11px] text-[#777]">صورتجلسه • مشاهده در جلسات</div>
      </div>
    </button>
  );
}

function InlineFileCard({ name, storageKey, projectId }: { name: string; storageKey: string | null; projectId?: string }) {
  const navigate = useNavigate();
  const targetUrl = projectId ? `/projects/${projectId}/files` : '/files';

  return (
    <button
      type="button"
      onClick={() => navigate(targetUrl)}
      dir="rtl"
      title={storageKey ?? name}
      className="my-1.5 flex w-full max-w-[380px] items-center gap-2.5 rounded-lg border border-[#e0e0e0] border-r-4 border-r-[#00bcd4] bg-white p-2.5 text-start shadow-sm hover:bg-[#00bcd4]/[0.04] transition-all"
      data-testid="chat-inline-file-card"
    >
      <MzIcon name="insert_drive_file" size={20} color="#00bcd4" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-[#222]" dir="ltr">{name}</div>
        <div className="text-[11px] text-[#777]">فایل پیوست • مشاهده در اسناد</div>
      </div>
    </button>
  );
}

export function ChatRichMessageBody({
  text,
  projectId,
  className,
}: {
  text: string;
  projectId?: string;
  className?: string;
}) {
  const parsed = useMemo(() => parseChatEntityMarkers(text), [text]);
  const visible = parsed.segments.length > 0 || !!parsed.importedSender;
  if (!visible) return null;

  return (
    <div className={clsx('space-y-1', className)}>
      {parsed.importedSender && (
        <div className="flex items-center gap-1.5 text-[11px] text-content-tertiary" dir="rtl">
          <span className="font-semibold text-[#1f5c88]">{parsed.importedSender}</span>
          {parsed.importedDate && <span>— {toPersianDigits(parsed.importedDate)}</span>}
        </div>
      )}
      {parsed.segments.map((seg, idx) => {
        if (seg.kind === 'task') return <InlineTaskCard key={idx} title={seg.title} projectId={projectId} />;
        if (seg.kind === 'minute') return <InlineMinuteCard key={idx} subject={seg.subject} projectId={projectId} />;
        if (seg.kind === 'file') return <InlineFileCard key={idx} name={seg.name} storageKey={seg.storageKey} projectId={projectId} />;
        if (seg.kind === 'call') {
          return (
            <div key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-surface-secondary px-2 py-1 text-xs text-content-secondary">
              <MzIcon name="call" size={12} color="#0f9d58" />
              <span>تماس</span>
            </div>
          );
        }
        if (seg.kind === 'event') {
          return (
            <div key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-surface-secondary px-2 py-1 text-xs text-content-tertiary">
              <MzIcon name="info" size={12} />
              <span>{seg.action}</span>
            </div>
          );
        }
        if (seg.kind === 'deleted') {
          return <span key={idx} className="text-xs italic text-content-quaternary">پیام حذف‌شده</span>;
        }
        return (
          <p key={idx} className="text-xs text-content-secondary leading-relaxed whitespace-pre-wrap break-words" dir="auto">
            {renderMentions(seg.text)}
          </p>
        );
      })}
    </div>
  );
}
