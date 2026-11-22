import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import { sanitizeLetterHtml } from './lettersSanitize';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { MzIcon } from '../MzIcon';
import { useComposeLetter } from './useLetters';

export interface PickedRecipient {
  id: string;
  name: string;
  title: string | null;
  avatar_url: string | null;
}

interface DirectoryUser {
  id: string;
  full_name: string;
  job_title?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
}

export const RECIPIENT_DIRECTORY_KEY = ['letters-recipient-directory'] as const;

/** Recipient picker: search box plus picked chips. Each row shows avatar, name and job title. */
export function RecipientPicker({
  value,
  onChange,
}: {
  value: PickedRecipient[];
  onChange: (next: PickedRecipient[]) => void;
}) {
  const [query, setQuery] = useState('');
  const directory = useQuery({
    queryKey: RECIPIENT_DIRECTORY_KEY,
    queryFn: () => apiGet<DirectoryUser[]>('/v1/users/?limit=100&is_active=true'),
    staleTime: 60_000,
  });
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const picked = new Set(value.map((v) => v.id));
    return (directory.data ?? [])
      .filter((u) => u.is_active !== false && !picked.has(u.id))
      .filter((u) => !q || u.full_name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [directory.data, query, value]);

  return (
    <div className="mz-letters-picker" data-testid="letters-recipient-picker">
      <div className="mz-letters-picker-chips">
        {value.map((r) => (
          <span key={r.id} className="mz-letters-chip">
            {r.name}
            <button
              type="button"
              aria-label={`حذف ${r.name}`}
              onClick={() => onChange(value.filter((v) => v.id !== r.id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="search"
        aria-label="جستجوی گیرنده"
        placeholder="نام گیرنده"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() ? (
        <ul className="mz-letters-picker-list">
          {matches.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                data-testid="letters-recipient-option"
                onClick={() => {
                  onChange([
                    ...value,
                    { id: u.id, name: u.full_name, title: u.job_title ?? null, avatar_url: u.avatar_url ?? null },
                  ]);
                  setQuery('');
                }}
              >
                <UserAvatar url={u.avatar_url} alt={u.full_name} className="mz-letters-avatar" />
                <span className="mz-letters-picker-name">{u.full_name}</span>
                {u.job_title ? <span className="mz-letters-picker-title">{u.job_title}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Rich text box with the spec toolbar (link, italic, bold, ordered list, bullet list). */
function RichTextBox({ onChange }: { onChange: (html: string, text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    if (cmd === 'createLink') {
      const url = window.prompt('نشانی پیوند');
      if (!url) return;
      document.execCommand(cmd, false, url);
    } else {
      document.execCommand(cmd, false, arg);
    }
    emit();
  };
  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(el.innerHTML, el.textContent ?? '');
  };
  const tools: { cmd: string; icon: string; label: string; arg?: string }[] = [
    { cmd: 'createLink', icon: 'link', label: 'پیوند' },
    { cmd: 'italic', icon: 'format_italic', label: 'کج' },
    { cmd: 'bold', icon: 'format_bold', label: 'درشت' },
    { cmd: 'insertOrderedList', icon: 'format_list_numbered', label: 'فهرست شماره‌دار' },
    { cmd: 'insertUnorderedList', icon: 'format_list_bulleted', label: 'فهرست نقطه‌ای' },
  ];
  return (
    <div className="mz-letters-richtext">
      <div className="mz-letters-richtext-toolbar" role="toolbar" aria-label="ابزار متن">
        {tools.map((t) => (
          <button key={t.cmd} type="button" aria-label={t.label} onClick={() => exec(t.cmd, t.arg)}>
            <MzIcon name={t.icon} size={18} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-label="متن"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        className="mz-letters-richtext-body"
        data-testid="letters-compose-body"
        onInput={emit}
      />
    </div>
  );
}

interface Props {
  onClose: () => void;
  onSent?: (letterId: string) => void;
}

export function MizitoComposeLetterModal({ onClose, onSent }: Props) {
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState<PickedRecipient[]>([]);
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const compose = useComposeLetter();

  const canSend = subject.trim().length > 0 && recipients.length > 0 && bodyText.trim().length > 0;

  const submit = () => {
    if (!canSend || compose.isPending) return;
    compose.mutate(
      {
        subject: subject.trim(),
        body: sanitizeLetterHtml(bodyHtml),
        to_user_ids: recipients.map((r) => r.id),
        label_ids: [],
      },
      {
        onSuccess: (res) => {
          onSent?.(res.id);
          onClose();
        },
      },
    );
  };

  return (
    <div className="mz-letters-modal-backdrop" role="presentation">
      <div role="dialog" aria-modal="true" aria-label="ارسال پیام" className="mz-letters-modal" dir="rtl">
        <header className="mz-letters-modal-head">
          <h2>ارسال پیام</h2>
          <button type="button" aria-label="بستن" onClick={onClose}>
            <MzIcon name="close" size={18} />
          </button>
        </header>

        <Field label="موضوع">
          <input
            type="text"
            className="mz-letters-underlined"
            aria-label="موضوع"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>

        <Field label="به">
          <RecipientPicker value={recipients} onChange={setRecipients} />
        </Field>

        <Field label="متن">
          <RichTextBox
            onChange={(html, text) => {
              setBodyHtml(html);
              setBodyText(text);
            }}
          />
        </Field>

        <Field label="برچسب‌ها">
          <button type="button" className="mz-letters-add" aria-label="افزودن برچسب" disabled>
            <MzIcon name="add" size={16} />
          </button>
        </Field>

        <Field label="پیوست‌ها">
          <label className="mz-letters-add">
            <MzIcon name="attach_file" size={16} />
            <input
              type="file"
              multiple
              aria-label="افزودن پیوست"
              onChange={(e) => setAttachments(Array.from(e.target.files ?? []))}
            />
          </label>
          {attachments.length > 0 ? (
            <ul className="mz-letters-attachments">
              {attachments.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          ) : null}
        </Field>

        <footer className="mz-letters-modal-foot">
          <button type="button" className="mz-letters-link" onClick={onClose}>
            انصراف
          </button>
          <button
            type="button"
            className="mz-letters-primary"
            data-testid="letters-compose-submit"
            disabled={!canSend || compose.isPending}
            onClick={submit}
          >
            ارسال
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mz-letters-field">
      <span className="mz-letters-field-label">{label}</span>
      {children}
    </div>
  );
}
