import type { StreamItem } from '../../types';
import { parseRawFileTags } from '../../lib/rawFileTag';
import { formatStreamTime, StreamCardFooterBar } from './StreamChatMessageCard';

export interface StreamTaskActivityCardProps {
  item: StreamItem;
  onReply: (item: StreamItem) => void;
  onReact: (item: StreamItem, emoji: string) => void;
  onOpenTask?: (taskId: string) => void;
  currentUserId?: string | null;
}

export function StreamTaskActivityCard({
  item,
  onReply,
  onReact,
  onOpenTask,
  currentUserId,
}: StreamTaskActivityCardProps) {
  const activity = item.rawTaskActivity;
  const taskId = activity?.taskId ?? '';
  const taskTitle = activity?.taskTitle || 'وظیفه';
  const actorName = activity?.actorName || item.authorName || 'همکار';
  const actionText = activity?.actionText || 'را تغییر داد';
  const reportText = activity?.reportText ?? (activity?.isReport ? parseRawFileTags(item.text ?? '').text : undefined);
  const isReport = Boolean(activity?.isReport || reportText);
  const timeText = formatStreamTime(item.createdAt);

  return (
    <article
      className="flex w-full flex-col items-center py-1"
      data-testid={`stream-card-task-${item.id}`}
    >
      <div className="mz-activity-pill inline-flex max-w-full flex-wrap items-center justify-center gap-1 text-center text-[12px]">
        <span className="font-medium text-black/80">{actorName}</span>
        <span>وظیفه</span>
        {taskId && onOpenTask ? (
          <button
            type="button"
            onClick={() => onOpenTask(taskId)}
            className="font-semibold text-[#3078ab] underline decoration-[#3078ab]/40 underline-offset-2 hover:text-[#235b82]"
          >
            «{taskTitle}»
          </button>
        ) : (
          <span className="font-semibold text-black/85">«{taskTitle}»</span>
        )}
        <span>{actionText}</span>
        {!isReport && timeText && (
          <span className="mz-time-muted ms-1">({timeText})</span>
        )}
      </div>

      {isReport && reportText && (
        <div className="mt-2 w-full max-w-[min(92%,760px)] rounded-lg border border-[#e5e7eb] bg-[#f5f6f8] px-3.5 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 pt-0.5 text-[12px] font-medium text-[#757575]">
              گزارش جدید:
            </span>
            <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] font-semibold leading-[1.6] text-black/90">
              {reportText}
            </p>
            {timeText && <span className="mz-time-muted shrink-0 pt-0.5">{timeText}</span>}
          </div>

          <StreamCardFooterBar
            item={item}
            onReply={onReply}
            onReact={onReact}
            replyCount={activity?.replyCount ?? 0}
            currentUserId={currentUserId}
            align="start"
          />
        </div>
      )}
    </article>
  );
}
