import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MzIcon } from '@/features/projects/workspace/components/MzIcon';
import { MizitoPageShell } from '@/modules/_shared/MizitoPageShell';
import { NOTE_COLORS, notesApi, type NoteInput, type UserNote } from './api';

type Editor = { mode: 'create' } | { mode: 'edit'; note: UserNote };

const NOTES_KEY = ['user-notes'];

export function NotesModule() {
  const queryClient = useQueryClient();
  const notesQuery = useQuery({ queryKey: NOTES_KEY, queryFn: () => notesApi.list() });
  const notes: UserNote[] = notesQuery.data ?? [];
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<UserNote | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTES_KEY });

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: NoteInput }) =>
      id ? notesApi.update(id, input) : notesApi.create(input),
    onSuccess: () => {
      setEditor(null);
      void refresh();
    },
  });

  const pinMutation = useMutation({
    mutationFn: (note: UserNote) => notesApi.update(note.id, { pinned: !note.pinned }),
    onSuccess: () => void refresh(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: () => {
      setDeleting(null);
      void refresh();
    },
  });

  return (
    <MizitoPageShell navActiveTo="/notes" testId="mizito-notes">
      <section className="p-4" data-testid="notes-page">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-[18px] font-semibold text-[#1f2937]">یادداشت‌های من</h1>
          <button
            type="button"
            data-testid="notes-create"
            onClick={() => setEditor({ mode: 'create' })}
            className="inline-flex items-center gap-1 rounded-md bg-[#1f5c88] px-3 py-1.5 text-[13px] font-medium text-white"
          >
            <MzIcon name="add" size={16} />
            یادداشت جدید
          </button>
        </header>

        {notesQuery.isLoading ? <p className="py-6 text-center text-[13px] text-[#607d8b]">در حال بارگذاری…</p> : null}

        {!notesQuery.isLoading && notes.length === 0 ? (
          <p data-testid="notes-empty" className="py-10 text-center text-[13px] text-[#607d8b]">
            یادداشتی ندارید
          </p>
        ) : null}

        <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }} data-testid="notes-grid">
          {notes.map((note) => (
            <li
              key={note.id}
              data-testid={`note-card-${note.id}`}
              className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white"
            >
              <div data-testid={`note-color-bar-${note.id}`} className="h-1.5" style={{ background: note.color }} />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[14px] font-semibold text-[#1f2937]">{note.title || 'بدون عنوان'}</h2>
                  <button
                    type="button"
                    data-testid={`note-pin-${note.id}`}
                    aria-pressed={note.pinned}
                    aria-label={note.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}
                    onClick={() => pinMutation.mutate(note)}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${note.pinned ? 'text-[#db4437]' : 'text-[#607d8b]'}`}
                  >
                    <MzIcon name="push_pin" size={16} />
                  </button>
                </div>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[12.5px] text-[#4b5563]">{note.body}</p>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    data-testid={`note-edit-${note.id}`}
                    aria-label="ویرایش یادداشت"
                    onClick={() => setEditor({ mode: 'edit', note })}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#1f5c88]"
                  >
                    <MzIcon name="edit" size={16} />
                  </button>
                  <button
                    type="button"
                    data-testid={`note-delete-${note.id}`}
                    aria-label="حذف یادداشت"
                    onClick={() => setDeleting(note)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#db4437]"
                  >
                    <MzIcon name="delete" size={16} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {editor ? (
          <NoteEditorDialog
            key={editor.mode === 'edit' ? editor.note.id : 'new'}
            initial={editor.mode === 'edit' ? editor.note : null}
            busy={saveMutation.isPending}
            onCancel={() => setEditor(null)}
            onSave={(input) =>
              saveMutation.mutate({ id: editor.mode === 'edit' ? editor.note.id : null, input })
            }
          />
        ) : null}

        {deleting ? (
          <div role="dialog" aria-modal="true" data-testid="notes-delete-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-4">
              <p className="mb-4 text-[14px] text-[#1f2937]">این یادداشت حذف شود؟</p>
              <div className="flex justify-start gap-2">
                <button
                  type="button"
                  data-testid="notes-delete-confirm"
                  onClick={() => deleteMutation.mutate(deleting.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-md bg-[#db4437] px-3 py-1.5 text-[13px] text-white"
                >
                  حذف
                </button>
                <button
                  type="button"
                  data-testid="notes-delete-cancel"
                  onClick={() => setDeleting(null)}
                  className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-[13px] text-[#1f2937]"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </MizitoPageShell>
  );
}

interface NoteEditorDialogProps {
  initial: UserNote | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: NoteInput) => void;
}

function NoteEditorDialog({ initial, busy, onCancel, onSave }: NoteEditorDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [color, setColor] = useState<string>(initial?.color ?? NOTE_COLORS[0]);

  return (
    <div role="dialog" aria-modal="true" aria-label="ویرایش یادداشت" data-testid="note-editor" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4">
        <label className="mb-3 block text-[12.5px] text-[#4b5563]">
          عنوان
          <input
            data-testid="note-title-input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[13px]"
          />
        </label>
        <label className="mb-3 block text-[12.5px] text-[#4b5563]">
          متن
          <textarea
            data-testid="note-body-input"
            value={body}
            rows={5}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[13px]"
          />
        </label>
        <div className="mb-4 flex items-center gap-2" role="radiogroup" aria-label="رنگ یادداشت">
          {NOTE_COLORS.map((hex, index) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={color === hex}
              data-testid={`note-editor-color-${index}`}
              aria-label={`رنگ ${index + 1}`}
              onClick={() => setColor(hex)}
              className={`h-6 w-6 rounded-full border-2 ${color === hex ? 'border-[#1f2937]' : 'border-transparent'}`}
              style={{ background: hex }}
            />
          ))}
        </div>
        <div className="flex justify-start gap-2">
          <button
            type="button"
            data-testid="note-save"
            disabled={busy}
            onClick={() => onSave({ title: title.trim(), body, color })}
            className="rounded-md bg-[#1f5c88] px-3 py-1.5 text-[13px] text-white disabled:opacity-60"
          >
            ذخیره
          </button>
          <button
            type="button"
            data-testid="note-cancel"
            onClick={onCancel}
            className="rounded-md border border-[#e5e7eb] px-3 py-1.5 text-[13px] text-[#1f2937]"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
