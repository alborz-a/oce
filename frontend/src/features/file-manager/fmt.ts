// [RSC-IRAN] Region-aware number and size text for the file manager.
import { REGION_LOCK } from '@/app/regionLock';
import { toPersianDigits } from '@/shared/lib/jalali';

const FA_UNITS: Record<string, string> = {
  B: 'بایت',
  KB: 'کیلوبایت',
  MB: 'مگابایت',
  GB: 'گیگابایت',
  TB: 'ترابایت',
};

/** Persian digits for a count when the Iran region lock is on. */
export function fmtCount(n: number): string {
  if (!REGION_LOCK) return String(n);
  // Group thousands on the ASCII digits first, then swap to Persian digits.
  return toPersianDigits(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));
}

/** Localize an English size string such as "1.5 GB" (digits and unit). */
export function localizeSize(text: string): string {
  if (!REGION_LOCK) return text;
  const m = text.match(/^(.*?)\s*(TB|GB|MB|KB|B)$/);
  const out = m ? `${m[1]} ${FA_UNITS[m[2] ?? ''] ?? m[2]}` : text;
  return toPersianDigits(out.replace('.', '٫'));
}

/** Percent text ("۵۰٪" under the Iran region lock) with Persian digits. */
export function fmtPct(value: number, decimals = 0): string {
  const n = Number.isFinite(value) ? value : 0;
  const fixed = n.toFixed(decimals);
  if (!REGION_LOCK) return `${fixed}%`;
  return `${toPersianDigits(fixed.replace('.', '٫'))}٪`;
}
