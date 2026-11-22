import { useState } from 'react';
import type { LetterLabel } from './lettersApi';
import { useCreateLabel, useLabels } from './useLetters';

/**
 * Stable hue per label id. The backend label has no color field, so the chip
 * color is derived from the id and is the same on every device.
 */
export function labelHue(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function LabelChip({ label }: { label: LetterLabel }) {
  return (
    <span
      className="mz-letters-label-chip"
      aria-hidden="true"
      style={{ backgroundColor: `hsl(${labelHue(label.id)} 65% 45%)` }}
    />
  );
}

interface Props {
  activeLabelId: string | null;
  onSelect: (label: LetterLabel) => void;
}

/** «برچسب‌ها» tab body: own labels, create form, click a label to filter the mailbox. */
export function MizitoLabelsPanel({ activeLabelId, onSelect }: Props) {
  const labels = useLabels();
  const create = useCreateLabel();
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed, { onSuccess: () => setName('') });
  };

  return (
    <section className="mz-letters-labels" data-testid="letters-labels-panel" aria-label="برچسب‌ها">
      <form
        className="mz-letters-label-create"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="text"
          aria-label="نام برچسب جدید"
          placeholder="نام برچسب"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" data-testid="letters-label-create" disabled={!name.trim() || create.isPending}>
          افزودن برچسب
        </button>
      </form>
      {create.isError ? <p className="mz-letters-empty">خطا در ساخت برچسب</p> : null}
      {labels.isError ? <p className="mz-letters-empty">خطا در بارگذاری برچسب‌ها</p> : null}
      {labels.data && labels.data.length === 0 ? <p className="mz-letters-empty">برچسبی وجود ندارد</p> : null}
      <ul className="mz-letters-label-list">
        {(labels.data ?? []).map((l) => (
          <li key={l.id}>
            <button
              type="button"
              data-testid="letters-label-item"
              aria-pressed={activeLabelId === l.id}
              className={`mz-letters-label-item${activeLabelId === l.id ? ' is-active' : ''}`}
              onClick={() => onSelect(l)}
            >
              <LabelChip label={l} />
              <span>{l.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
