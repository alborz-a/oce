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
  return REGION_LOCK ? toPersianDigits(n) : String(n);
}

/** Localize an English size string such as "1.5 GB" (digits and unit). */
export function localizeSize(text: string): string {
  if (!REGION_LOCK) return text;
  const m = text.match(/^(.*?)\s*(TB|GB|MB|KB|B)$/);
  const out = m ? `${m[1]} ${FA_UNITS[m[2] ?? ''] ?? m[2]}` : text;
  return toPersianDigits(out.replace('.', '٫'));
}
