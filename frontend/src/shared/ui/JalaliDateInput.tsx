// [RSC-IRAN] Jalali (شمسی) drop-in for <input type="date">. Value/onChange stay Gregorian ISO YYYY-MM-DD.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FocusEvent, InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import { REGION_LOCK } from '@/app/regionLock';
import {
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAY_NAMES,
  PERSIAN_WEEKDAY_SHORT,
  formatJalali,
  gregorianToJalali,
  jalaliToGregorian,
  toPersianDigits,
} from '@/shared/lib/jalali';

type NativeProps = InputHTMLAttributes<HTMLInputElement>;
export type JalaliDateInputProps = Omit<NativeProps, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'> & {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
};

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(gy: number, gm: number, gd: number): string {
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

function parseIso(v?: string | null): { gy: number; gm: number; gd: number } | null {
  const m = v ? ISO_RE.exec(v) : null;
  if (!m) return null;
  return { gy: +m[1]!, gm: +m[2]!, gd: +m[3]! };
}

function todayIso(): string {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const { gy, gm, gd } = jalaliToGregorian(jy, 12, 30);
  const back = gregorianToJalali(gy, gm, gd);
  return back.jy === jy && back.jm === 12 && back.jd === 30 ? 30 : 29;
}

/** Column index 0..6 with Saturday = 0, Friday = 6 */
function satIndex(gy: number, gm: number, gd: number): number {
  return (new Date(gy, gm - 1, gd).getDay() + 1) % 7;
}

export function JalaliDateInput(props: JalaliDateInputProps) {
  if (!REGION_LOCK) {
    const { value, defaultValue, onChange, ...rest } = props;
    if (value === undefined) {
      return <input {...rest} type="date" defaultValue={defaultValue ?? ''} onChange={onChange} />;
    }
    return <input {...rest} type="date" value={value ?? ''} onChange={onChange} />;
  }
  return <JalaliDateInputInner {...props} />;
}

function JalaliDateInputInner({
  value: valueProp,
  defaultValue,
  onChange,
  min,
  max,
  className,
  disabled,
  name,
  placeholder,
  onBlur,
  id,
  required,
  readOnly,
  ...rest
}: JalaliDateInputProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [inner, setInner] = useState<string | null>(valueProp ?? defaultValue ?? null);
  const value = valueProp !== undefined ? valueProp : inner;
  const rootRef = useRef<HTMLDivElement>(null);
  const sel = parseIso(value);
  const base = sel ?? parseIso(todayIso())!;
  const baseJ = gregorianToJalali(base.gy, base.gm, base.gd);
  const [view, setView] = useState({ jy: baseJ.jy, jm: baseJ.jm });

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const emit = useCallback(
    (next: string) => {
      setInner(next);
      const t = { value: next, name: name ?? '' };
      onChange?.({ target: t, currentTarget: t } as unknown as ChangeEvent<HTMLInputElement>);
      onBlur?.({ target: t, currentTarget: t } as unknown as FocusEvent<HTMLInputElement>);
    },
    [onChange, onBlur, name],
  );

  const cells = useMemo(() => {
    const { jy, jm } = view;
    const first = jalaliToGregorian(jy, jm, 1);
    const lead = satIndex(first.gy, first.gm, first.gd);
    const len = jalaliMonthLength(jy, jm);
    const out: Array<{ jd: number; iso: string } | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= len; d++) {
      const g = jalaliToGregorian(jy, jm, d);
      out.push({ jd: d, iso: toIso(g.gy, g.gm, g.gd) });
    }
    return out;
  }, [view]);

  const shift = (delta: number) =>
    setView(({ jy, jm }) => {
      const idx = jy * 12 + (jm - 1) + delta;
      return { jy: Math.floor(idx / 12), jm: (idx % 12) + 1 };
    });

  const openPopup = () => {
    if (disabled || readOnly) return;
    setView({ jy: baseJ.jy, jm: baseJ.jm });
    const rect = rootRef.current?.getBoundingClientRect();
    setDropUp(!!rect && window.innerHeight - rect.bottom < 320 && rect.top > 320);
    setOpen((o) => !o);
  };

  const pick = (iso: string) => {
    emit(iso);
    setOpen(false);
  };

  const today = todayIso();
  const display = sel ? formatJalali(value as string) : '';

  return (
    <div ref={rootRef} className="relative" dir="rtl">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={openPopup}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        className={clsx('text-start', className)}
        {...(rest as Record<string, unknown>)}
      >
        {display || <span className="text-content-tertiary">{placeholder ?? '----/--/--'}</span>}
      </button>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      {open && (
        <div
          role="dialog"
          dir="rtl"
          className={clsx('absolute z-50 w-64 rounded-lg border border-border-light bg-surface-primary p-3 shadow-lg', dropUp ? 'bottom-full mb-1' : 'mt-1')}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="ماه قبل" className="rounded px-2 py-1 hover:bg-surface-secondary">
              ›
            </button>
            <span className="text-sm font-medium text-content-primary">
              {PERSIAN_MONTH_NAMES[view.jm - 1]} {toPersianDigits(view.jy)}
            </span>
            <button type="button" onClick={() => shift(1)} aria-label="ماه بعد" className="rounded px-2 py-1 hover:bg-surface-secondary">
              ‹
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {PERSIAN_WEEKDAY_SHORT.map((w, i) => (
              <span
                key={w}
                title={PERSIAN_WEEKDAY_NAMES[i]}
                className={clsx('py-1', i === 6 ? 'text-semantic-error' : 'text-content-tertiary')}
              >
                {w}
              </span>
            ))}
            {cells.map((c, i) => {
              if (!c) return <span key={`e${i}`} />;
              const off = (min && c.iso < min) || (max && c.iso > max);
              const isSel = c.iso === (value ?? '').slice(0, 10);
              return (
                <button
                  key={c.iso}
                  type="button"
                  disabled={!!off}
                  onClick={() => pick(c.iso)}
                  aria-pressed={isSel}
                  className={clsx(
                    'rounded py-1 text-sm disabled:opacity-30',
                    isSel ? 'bg-oe-blue text-white' : 'hover:bg-surface-secondary',
                    !isSel && c.iso === today && 'border border-oe-blue',
                    !isSel && i % 7 === 6 && 'text-semantic-error',
                  )}
                >
                  {toPersianDigits(c.jd)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <button type="button" onClick={() => pick(today)} className="text-oe-blue-text hover:underline">
              امروز
            </button>
            {!required && (
              <button type="button" onClick={() => pick('')} className="text-content-secondary hover:underline">
                پاک کردن
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default JalaliDateInput;
