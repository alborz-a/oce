import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadWithAuth } from '@/shared/lib/api';
import { formatJalali, PERSIAN_WEEKDAY_NAMES, toPersianDigits } from '@/shared/lib/jalali';
import { displayName } from '@/features/projects/workspace/lib/importerAuthor';
import { parseRawFileTags } from '@/features/projects/workspace/lib/rawFileTag';
import { ChatRichMessageBody } from '@/shared/ui/ChatEntityCards';
import { JobTitleBadge } from '@/shared/ui/JobTitleBadge';
import type { ChatMessage } from './types';

export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = toPersianDigits(String(d.getHours()).padStart(2, '0'));
  const mm = toPersianDigits(String(d.getMinutes()).padStart(2, '0'));
  return `${formatJalali(d)} ${hh}:${mm}`;
}

/** Time only (HH:MM, Persian digits) shown under a bubble; the date lives in the day separator. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = toPersianDigits(String(d.getHours()).padStart(2, '0'));
  const mm = toPersianDigits(String(d.getMinutes()).padStart(2, '0'));
  return `${hh}:${mm}`;
}

/** Relative age label used in the day separator, e.g. «۴ ماه قبل». */
export function relativeAge(d: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days < 1) return 'امروز';
  if (days < 30) return `${toPersianDigits(days)} روز قبل`;
  if (days < 365) return `${toPersianDigits(Math.floor(days / 30))} ماه قبل`;
  return `${toPersianDigits(Math.floor(days / 365))} سال قبل`;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Day separator pill: weekday + Jalali date on the first line, relative age in brackets on the second. */
function DaySeparator({ iso }: { iso: string }) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const weekday = PERSIAN_WEEKDAY_NAMES[(d.getDay() + 1) % 7];
  return (
    <div className="flex justify-center py-1" data-testid="day-separator">
      <div className="rounded-lg bg-surface-secondary px-3 py-1 text-center text-xs text-content-secondary">
        <div>{`${weekday} ${formatJalali(d, 'long')}`}</div>
        <div>{`(${relativeAge(d)})`}</div>
      </div>
    </div>
  );
}

interface Props {
  messages: ChatMessage[];
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  documentNames?: Record<string, string>;
  projectId?: string;
}

/** Messages oldest-first; scrolling to the top loads the older page (infinite scroll upward). */
export function MessageList({ messages, hasMore, loadingOlder, onLoadOlder, documentNames = {}, projectId }: Props) {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const prevHeight = useRef(0);
  const byId = new Map(messages.map((m) => [m.id, m]));

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (prevHeight.current && !stickRef.current) {
      el.scrollTop = el.scrollHeight - prevHeight.current; // keep position after prepending older messages
    } else if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevHeight.current = 0;
  }, [messages]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore && !loadingOlder) {
      prevHeight.current = el.scrollHeight;
      onLoadOlder();
    }
  };

  return (
    <div ref={boxRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto p-3" data-testid="message-list">
      {hasMore && (
        <button type="button" className="mx-auto block text-xs text-oe-blue" onClick={onLoadOlder} disabled={loadingOlder}>
          {t('team_chat.load_older', { defaultValue: 'پیام‌های قدیمی‌تر' })}
        </button>
      )}
      {messages.map((m, i) => {
        const quoted = m.reply_to_id ? byId.get(m.reply_to_id) : undefined;
        const author = displayName(m.author_name, m.author_id);
        const showDay = i === 0 || dayKey(messages[i - 1]!.created_at) !== dayKey(m.created_at);
        return (
          <div key={m.id}>
            {showDay && <DaySeparator iso={m.created_at} />}
            <div className="flex items-end gap-2" data-message-id={m.id}>
              <div className="flex max-w-[75%] min-w-0 flex-col items-end">
                <div className="mb-1 flex items-baseline gap-2 text-xs text-content-tertiary">
                  <span className="font-semibold text-content-secondary" dir="auto">
                    {author}
                  </span>
                  <JobTitleBadge title={m.author_title} />
                  {m.edited_at && <span>{t('team_chat.edited', { defaultValue: 'ویرایش‌شده' })}</span>}
                </div>
                <div className="rounded-2xl bg-surface-secondary px-3 py-2">
                  {quoted && (
                    <div dir="auto" className="my-1 border-s-2 border-oe-blue ps-2 text-xs text-content-tertiary" data-testid="reply-quote">
                      {quoted.author_name}: {parseRawFileTags(quoted.text).text.slice(0, 120)}
                    </div>
                  )}
                  {m.text && <ChatRichMessageBody text={m.text} projectId={projectId} />}
                  {m.document_ids.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {m.document_ids.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className="rounded border border-border-light px-2 py-0.5 text-xs text-oe-blue"
                          onClick={() => downloadWithAuth(`/api/v1/documents/${id}/download/`, documentNames[id] || 'document').catch(() => {})}
                        >
                          {documentNames[id] || t('team_chat.document', { defaultValue: 'سند' })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="mt-1 text-xs text-content-tertiary">{formatTime(m.created_at)}</span>
              </div>
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs text-content-secondary" aria-hidden="true">
                  {author.charAt(0)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
