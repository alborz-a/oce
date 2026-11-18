import { useState } from 'react';
import { CalendarDays, ClipboardList, FileDown, Loader2, Users } from 'lucide-react';
import { downloadWithAuth } from '@/shared/lib/api';
import { formatJalali, toPersianDigits } from '@/shared/lib/jalali';
import type { StreamItem } from '../../types';
import { parseRawFileTags } from '../../lib/rawFileTag';
import { formatStreamTime, StreamCardFooterBar } from './StreamChatMessageCard';

export interface StreamMeetingMinutesCardProps {
  item: StreamItem;
  onReply: (item: StreamItem) => void;
  onReact: (item: StreamItem, emoji: string) => void;
  currentUserId?: string | null;
}

export function StreamMeetingMinutesCard({
  item,
  onReply,
  onReact,
  currentUserId,
}: StreamMeetingMinutesCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const meeting = item.rawMeeting;
  const captionText = parseRawFileTags(item.text ?? '').text.trim();
  const title = meeting?.title || captionText || 'صورتجلسه پروژه';
  const dateLabel = formatJalali(meeting?.date || item.createdAt, 'long');
  const timeText = formatStreamTime(item.createdAt);
  const attendees = meeting?.attendees ?? [];
  const visibleAttendees = attendees.slice(0, 4);
  const remainingAttendees = Math.max(0, attendees.length - visibleAttendees.length);
  const pdfUrl =
    meeting?.pdfUrl ||
    (meeting?.meetingId ? `/api/v1/meetings/${meeting.meetingId}/minutes/export/pdf/` : '');

  const handleDownloadPdf = async () => {
    if (!pdfUrl || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadWithAuth(pdfUrl, `minutes_${meeting?.meetingId || item.id}.pdf`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'خطا در دانلود صورتجلسه');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      className="flex w-full flex-col items-center py-1"
      data-testid={`stream-card-minutes-${item.id}`}
    >
      <div className="w-full max-w-[min(92%,660px)] rounded-[10px] border border-[#e5e7eb] border-s-4 border-s-[#6ab04c] bg-[#f5f6f8] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#6ab04c]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#47812f]">
              <ClipboardList size={12} />
              <span>صورتجلسه</span>
            </span>
            <h4 className="truncate text-[13.5px] font-semibold text-black/85">{title}</h4>
          </div>

          {pdfUrl && (
            <button
              type="button"
              onClick={() => {
                void handleDownloadPdf();
              }}
              disabled={downloading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#3078ab]/30 bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#3078ab] transition-colors hover:bg-[#3078ab]/5 disabled:opacity-50"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              <span>دانلود PDF صورتجلسه</span>
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#6b7280]">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} />
            <span>{dateLabel}</span>
          </span>

          {attendees.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users size={12} />
              <span>
                حاضرین: {visibleAttendees.join('، ')}
                {remainingAttendees > 0 ? ` و +${toPersianDigits(remainingAttendees)} نفر` : ''}
              </span>
            </span>
          )}

          {timeText && <span className="mz-time-muted ms-auto">{timeText}</span>}
        </div>

        {captionText && captionText !== title.trim() && (
          <p className="mt-2 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-black/75">
            {captionText}
          </p>
        )}

        {downloadError && (
          <p className="mt-1.5 text-[11px] text-[#d9534f]" role="alert">
            {downloadError}
          </p>
        )}

        <StreamCardFooterBar
          item={item}
          onReply={onReply}
          onReact={onReact}
          currentUserId={currentUserId}
          align="start"
        />
      </div>
    </article>
  );
}
