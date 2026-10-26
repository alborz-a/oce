import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectDocument } from './types';

interface Props {
  disabled?: boolean;
  /** Documents of the room's project that can be attached (project rooms only). */
  documents: ProjectDocument[];
  onSend: (text: string, documentIds: string[]) => Promise<void> | void;
  /** Upload a file into the room's project; resolves with the new document (project rooms only). */
  onUpload?: (file: File) => Promise<ProjectDocument | null>;
}

export function Composer({ disabled, documents, onSend, onUpload }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [attached, setAttached] = useState<ProjectDocument[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const body = text.trim();
    if ((!body && attached.length === 0) || busy || disabled) return;
    setBusy(true);
    try {
      await onSend(body, attached.map((d) => d.id));
      setText('');
      setAttached([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border-light p-2" data-testid="composer">
      {attached.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {attached.map((d) => (
            <span key={d.id} className="rounded bg-surface-secondary px-2 py-0.5 text-xs">
              {d.name}{' '}
              <button type="button" aria-label="remove" onClick={() => setAttached(attached.filter((x) => x.id !== d.id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          dir="auto"
          rows={2}
          value={text}
          disabled={disabled}
          placeholder={t('team_chat.placeholder', { defaultValue: 'پیام خود را بنویسید…' })}
          className="flex-1 resize-none rounded border border-border-light p-2 text-sm"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex flex-col gap-1">
          {documents.length > 0 && (
            <select
              className="rounded border border-border-light text-xs"
              value=""
              aria-label={t('team_chat.attach', { defaultValue: 'پیوست سند' })}
              onChange={(e) => {
                const d = documents.find((x) => x.id === e.target.value);
                if (d && !attached.some((x) => x.id === d.id)) setAttached([...attached, d]);
              }}
            >
              <option value="">{t('team_chat.attach', { defaultValue: 'پیوست سند' })}</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {onUpload && (
            <label className="cursor-pointer text-xs text-oe-blue">
              {t('team_chat.upload', { defaultValue: 'بارگذاری فایل' })}
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const d = await onUpload(f);
                  if (d) setAttached((cur) => [...cur, d]);
                }}
              />
            </label>
          )}
          <button
            type="button"
            className="rounded bg-oe-blue px-3 py-1 text-sm text-white disabled:opacity-50"
            disabled={disabled || busy}
            onClick={() => void send()}
          >
            {t('team_chat.send', { defaultValue: 'ارسال' })}
          </button>
        </div>
      </div>
    </div>
  );
}
