import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import { sanitizeLetterHtml } from './lettersSanitize';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { MzIcon } from '../MzIcon';
import { useComposeLetter } from './useLetters';
import { lettersApi } from './lettersApi';

type UploadStatus = 'pending' | 'uploading' | 'done' | 'failed';
interface UploadItem {
  file: File;
  status: UploadStatus;
}

const UPLOAD_STATUS_TEXT: Record<UploadStatus, string> = {
  pending: 'در انتظار ارسال',
  uploading: 'در حال ارسال',
  done: 'ارسال شد',
  failed: 'خطا در ارسال',
};

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
  const term = query.trim();
  // Server-side search so users beyond the first page are reachable; no search term means no request.
  const directory = useQuery({
    queryKey: [...RECIPIENT_DIRECTORY_KEY, term],
    queryFn: () =>
      apiGet<DirectoryUser[]>(
        `/v1/users/?${new URLSearchParams({ q: term, limit: '20', is_active: 'true' }).toString()}`,
      ),
    enabled: term.length > 0,
    staleTime: 60_000,
  });
  const matches = useMemo(() => {
    const picked = new Set(value.map((v) => v.id));
    return (directory.data ?? []).filter((u) => u.is_active !== false && !picked.has(u.id)).slice(0, 8);
  }, [directory.data, value]);

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
      {term ? (
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
  const [attachments, setAttachments] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const compose = useComposeLetter();

  const canSend = subject.trim().length > 0 && recipients.length > 0 && bodyText.trim().length > 0;

  const setStatus = (index: number, status: UploadStatus) =>
    setAttachments((prev) => prev.map((x, j) => (j === index ? { ...x, status } : x)));

  /** Uploads each non-done file in order, one request per file. Returns the failure count. */
  const uploadFiles = async (letterId: string, items: UploadItem[]): Promise<number> => {
    setUploading(true);
    let failed = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'done') continue;
      setStatus(i, 'uploading');
      try {
        await lettersApi.uploadAttachment(letterId, items[i].file);
        setStatus(i, 'done');
      } catch {
        failed += 1;
        setStatus(i, 'failed');
      }
    }
    setUploading(false);
    return failed;
  };

  const submit = () => {
    if (!canSend || compose.isPending || uploading || sentId) return;
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
          setSentId(res.id);
          if (attachments.length === 0) {
            onClose();
            return;
          }
          void uploadFiles(res.id, attachments).then((failed) => {
            if (failed === 0) onClose();
          });
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
              disabled={uploading || sentId !== null}
              onChange={(e) =>
                setAttachments(Array.from(e.target.files ?? []).map((file) => ({ file, status: 'pending' as const })))
              }
            />
          </label>
          {attachments.length > 0 ? (
            <ul className="mz-letters-attachments" data-testid="letters-compose-attachments">
              {attachments.map((item, i) => (
                <li key={`${item.file.name}-${i}`} data-status={item.status}>
                  <span>{item.file.name}</span>
                  <span className="mz-letters-attach-status">{UPLOAD_STATUS_TEXT[item.status]}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {sentId && attachments.some((a) => a.status === 'failed') ? (
            <button
              type="button"
              className="mz-letters-link"
              data-testid="letters-compose-retry"
              disabled={uploading}
              onClick={() =>
                void uploadFiles(sentId, attachments).then((failed) => {
                  if (failed === 0) onClose();
                })
              }
            >
              تلاش دوباره برای پیوست‌های ناموفق
            </button>
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
            disabled={!canSend || compose.isPending || uploading || sentId !== null}
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
