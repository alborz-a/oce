import { useEffect, useState } from 'react';
import { MzIcon } from '../MzIcon';
import { sanitizeLetterHtml } from './lettersSanitize';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { formatBytes } from '@/shared/lib/formatters';
import {
  useArchiveLetter,
  useRegisterLetter,
  useForwardLetter,
  useLabels,
  useLetterThread,
  useMarkLetterRead,
  useReplyLetter,
  useToggleLetterLabel,
} from './useLetters';
import { formatLetterAge, formatLetterDate, formatLetterDateTime } from './lettersFormat';
import { RecipientPicker, type PickedRecipient } from './MizitoComposeLetterModal';
import { LabelChip } from './MizitoLabelsPanel';
import type { LetterLabel } from './lettersApi';

interface Props {
  letterId: string;
  onBack: () => void;
}

/** Small picker under the header: tick a label to attach it to this letter, untick to detach. */
function LetterLabelPicker({ letterId, attached }: { letterId: string; attached: LetterLabel[] }) {
  const labels = useLabels();
  const toggle = useToggleLetterLabel(letterId);
  const attachedIds = new Set(attached.map((l) => l.id));
  return (
    <div className="mz-letters-label-picker" data-testid="letters-label-picker">
      {labels.data && labels.data.length === 0 ? <p className="mz-letters-empty">برچسبی وجود ندارد</p> : null}
      <ul>
        {(labels.data ?? []).map((l) => (
          <li key={l.id}>
            <label>
              <input
                type="checkbox"
                aria-label={l.name}
                checked={attachedIds.has(l.id)}
                disabled={toggle.isPending}
                onChange={(e) => toggle.mutate({ labelId: l.id, attach: e.target.checked })}
              />
              <LabelChip label={l} />
              <span>{l.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {toggle.isError ? <p className="mz-letters-empty">خطا در به‌روزرسانی برچسب</p> : null}
    </div>
  );
}

export function MizitoLetterDetail({ letterId, onBack }: Props) {
  const thread = useLetterThread(letterId);
  const markRead = useMarkLetterRead();
  const reply = useReplyLetter(letterId);
  const forward = useForwardLetter(letterId);
  const archive = useArchiveLetter(letterId);
  const register = useRegisterLetter(letterId);
  const [replyText, setReplyText] = useState('');
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardNote, setForwardNote] = useState('');
  const [forwardTo, setForwardTo] = useState<PickedRecipient[]>([]);
  const [archived, setArchived] = useState(false);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);

  useEffect(() => {
    markRead.mutate(letterId);
    // Only on letter change: opening marks the letter read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterId]);

  if (thread.isLoading) return <div className="mz-letters-detail" data-testid="letter-detail-loading" />;
  if (thread.isError || !thread.data) {
    return (
      <div className="mz-letters-detail">
        <button type="button" onClick={onBack}>بازگشت به کارتابل</button>
        <p>خطا در بارگذاری نامه</p>
      </div>
    );
  }

  const data = thread.data;
  const first = data.messages[0];
  const sentAt = first?.sent_at ?? '';

  return (
    <div className="mz-letters-detail" data-testid="mizito-letter-detail" dir="rtl">
      <header className="mz-letters-detail-head">
        <div className="mz-letters-detail-head-right">
          <button type="button" className="mz-letters-back" onClick={onBack} data-testid="letter-back">
            <MzIcon name="arrow_forward" size={18} flipRtl />
            <span>بازگشت به کارتابل</span>
          </button>
          <h2 className="mz-letters-detail-subject">موضوع: {data.subject}</h2>
        </div>
        <div className="mz-letters-detail-head-left">
          <button
            type="button"
            className="mz-letters-label-add"
            data-testid="letter-label-add"
            aria-expanded={labelPickerOpen}
            onClick={() => setLabelPickerOpen((v) => !v)}
          >
            <span>برچسب‌ها: +</span>
          </button>
          <button
            type="button"
            className="mz-letters-archive"
            data-testid="letter-archive"
            onClick={() => {
              const next = !archived;
              archive.mutate(next, { onSuccess: () => setArchived(next) });
            }}
          >
            {archived ? 'خروج از آرشیو' : 'آرشیو نامه'}
          </button>
          {data.letter_number ? null : (
            <button
              type="button"
              className="mz-letters-register"
              data-testid="letter-register"
              disabled={register.isPending}
              onClick={() => register.mutate('ق')}
            >
              ثبت در دبیرخانه
            </button>
          )}
          <button type="button" className="mz-letters-kebab" aria-label="گزینه‌های بیشتر">
            <MzIcon name="more_vert" size={18} />
          </button>
        </div>
      </header>

      {labelPickerOpen ? <LetterLabelPicker letterId={letterId} attached={data.labels} /> : null}

      <div className="mz-letters-detail-body">
        <aside className="mz-letters-meta" data-testid="letter-meta">
          <div className="mz-letters-meta-icons">
            <MzIcon name="bookmark_border" size={18} />
            <MzIcon name="print" size={18} />
          </div>
          <dl className="mz-letters-meta-box">
            <dt>نوع نامه</dt>
            <dd>{data.letter_type === 'outgoing' ? 'صادره' : 'وارده'}</dd>
            <dt>تاریخ ثبت</dt>
            <dd>{formatLetterDate(data.registered_at ?? sentAt)}</dd>
            <dt>شماره نامه</dt>
            <dd>{data.letter_number ?? data.reference_number ?? '—'}</dd>
          </dl>
        </aside>

        <section className="mz-letters-thread" aria-label="رشته پیام‌ها">
          {data.messages.map((m, idx) => (
            <article key={m.id} className="mz-letters-message" data-testid="letter-message">
              {idx === 0 && m.sent_at ? (
                <div className="mz-letters-age-chip">{formatLetterAge(m.sent_at)}</div>
              ) : null}
              <header className="mz-letters-message-head">
                <UserAvatar url={m.sender_avatar_url} alt={m.sender_name} className="mz-letters-avatar" />
                <span className="mz-letters-message-from">
                  {`${m.sender_name} به ${m.recipients.map((r) => r.name).join('، ')}`}
                </span>
                <time dateTime={m.sent_at}>{formatLetterDateTime(m.sent_at)}</time>
              </header>
              <div
                className="mz-letters-message-body"
                dangerouslySetInnerHTML={{ __html: sanitizeLetterHtml(m.body_html) }}
              />
              {m.attachments.length > 0 ? (
                <ul className="mz-letters-attachments">
                  {m.attachments.map((a) => (
                    <li key={a.id}>
                      <a href={a.download_url}>{a.name}</a>
                      <span data-testid="letter-attachment-size">{formatBytes(a.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}

          <div className="mz-letters-reply">
            <textarea
              aria-label="متن پاسخ"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
            />
            <button
              type="button"
              className="mz-letters-primary"
              data-testid="letter-reply-send"
              disabled={!replyText.trim() || reply.isPending}
              onClick={() =>
                reply.mutate(replyText.trim(), { onSuccess: () => setReplyText('') })
              }
            >
              پاسخ
            </button>
            <button
              type="button"
              className="mz-letters-primary"
              data-testid="letter-forward-toggle"
              onClick={() => setForwardOpen((v) => !v)}
            >
              ارجاع پیام به نفرات دیگر
            </button>
          </div>

          {forwardOpen ? (
            <div className="mz-letters-forward" data-testid="letter-forward-panel">
              <RecipientPicker value={forwardTo} onChange={setForwardTo} />
              <textarea
                aria-label="یادداشت ارجاع"
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
                rows={2}
              />
              <button
                type="button"
                className="mz-letters-primary"
                disabled={forwardTo.length === 0 || forward.isPending}
                onClick={() =>
                  forward.mutate(
                    { toUserIds: forwardTo.map((r) => r.id), note: forwardNote.trim() },
                    {
                      onSuccess: () => {
                        setForwardTo([]);
                        setForwardNote('');
                        setForwardOpen(false);
                      },
                    },
                  )
                }
              >
                ارجاع
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
