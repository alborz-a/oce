import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadWithAuth } from '@/shared/lib/api';
import { formatJalali, toPersianDigits } from '@/shared/lib/jalali';
import type { ChatMessage } from './types';

export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = toPersianDigits(String(d.getHours()).padStart(2, '0'));
  const mm = toPersianDigits(String(d.getMinutes()).padStart(2, '0'));
  return `${formatJalali(d)} ${hh}:${mm}`;
}

interface Props {
  messages: ChatMessage[];
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  documentNames?: Record<string, string>;
}

/** Messages oldest-first; scrolling to the top loads the older page (infinite scroll upward). */
export function MessageList({ messages, hasMore, loadingOlder, onLoadOlder, documentNames = {} }: Props) {
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
    <div ref={boxRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto p-3" data-testid="message-list">
      {hasMore && (
        <button type="button" className="mx-auto block text-xs text-oe-blue" onClick={onLoadOlder} disabled={loadingOlder}>
          {t('team_chat.load_older', { defaultValue: 'پیام‌های قدیمی‌تر' })}
        </button>
      )}
      {messages.map((m) => {
        const quoted = m.reply_to_id ? byId.get(m.reply_to_id) : undefined;
        return (
          <div key={m.id} className="rounded-lg bg-surface-secondary p-2" data-message-id={m.id}>
            <div className="flex items-baseline gap-2 text-xs text-content-tertiary">
              <span className="font-semibold text-content-secondary" dir="auto">
                {m.author_name}
              </span>
              <span>{formatStamp(m.created_at)}</span>
              {m.edited_at && <span>{t('team_chat.edited', { defaultValue: 'ویرایش‌شده' })}</span>}
            </div>
            {quoted && (
              <div dir="auto" className="my-1 border-s-2 border-oe-blue ps-2 text-xs text-content-tertiary" data-testid="reply-quote">
                {quoted.author_name}: {quoted.text.slice(0, 120)}
              </div>
            )}
            {m.text && (
              <p dir="auto" className="whitespace-pre-wrap break-words text-sm">
                {m.text}
              </p>
            )}
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
        );
      })}
    </div>
  );
}
