import {
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAY_NAMES,
  dateToJalali,
  formatJalali,
  toPersianDigits,
} from '@/shared/lib/jalali';

/**
 * «پنج‌شنبه ۲۵ تیر - ۱۸:۲۵» style label for list rows and message headers.
 * Weekday index: JS getDay() is Sunday=0, the Jalali weekday list starts at شنبه (Saturday).
 */
export function formatLetterDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const weekday = PERSIAN_WEEKDAY_NAMES[(d.getDay() + 1) % 7];
  const { jm, jd } = dateToJalali(d);
  const month = PERSIAN_MONTH_NAMES[jm - 1];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${weekday} ${toPersianDigits(jd)} ${month} - ${toPersianDigits(`${hh}:${mm}`)}`;
}

/** Short Jalali date «۱۴۰۵/۰۴/۲۵» for the registered-letter badge and meta box. */
export function formatLetterDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatJalali(iso, 'short');
}

/** «۱۰ روز قبل» style age chip. Falls back to the full date when older than a month. */
export function formatLetterAge(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'امروز';
  if (days < 30) return `${toPersianDigits(days)} روز قبل`;
  return formatLetterDate(iso);
}
