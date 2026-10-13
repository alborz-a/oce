// [RSC-IRAN] Jalali (شمسی) calendar utilities for Iran regional lock
// Standard mathematical conversion algorithm (jalaali-js) + native Intl formatting

export const PERSIAN_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const PERSIAN_WEEKDAY_NAMES = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

export const PERSIAN_WEEKDAY_SHORT = [
  'ش',
  'ی',
  'د',
  'س',
  'چ',
  'پ',
  'ج',
] as const;

/** Convert Latin or Arabic digits to Persian digits (۰-۹) */
export function toPersianDigits(input: string | number): string {
  const str = String(input);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[0-9]/g, (w) => persianDigits[+w]!)
            .replace(/[٠-٩]/g, (w) => persianDigits[arabicDigits.indexOf(w)]!);
}

/** Convert Persian or Arabic digits to standard Latin digits (0-9) */
export function toLatinDigits(input: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return input
    .replace(/[۰-۹]/g, (w) => String(persianDigits.indexOf(w)))
    .replace(/[٠-٩]/g, (w) => String(arabicDigits.indexOf(w)));
}

/**
 * Mathematical conversion from Gregorian (year, month 1-12, day 1-31) to Jalali
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  let g = gy - (gy <= 1600 ? 621 : 1600);
  const gy2 = gm > 2 ? g + 1 : g;
  let days = 365 * g + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1]!;
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/**
 * Mathematical conversion from Jalali (year, month 1-12, day 1-31) to Gregorian
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let j = jy - (jy <= 979 ? 0 : 979);
  let gy = jy <= 979 ? 621 : 1600;
  let days = 365 * j + Math.floor(j / 33) * 8 + Math.floor(((j % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm]!;
    if (gd <= v) break;
    gd -= v;
  }
  return { gy, gm, gd };
}

/** Convert a Date object to Jalali date tuple */
export function dateToJalali(date: Date): { jy: number; jm: number; jd: number } {
  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Format a Date to Jalali string:
 * - 'short': ۱۴۰۵/۰۷/۱۹
 * - 'long': ۱۹ مهر ۱۴۰۵
 */
export function formatJalali(dateInput: Date | string | number, formatStyle: 'short' | 'long' = 'short'): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const { jy, jm, jd } = dateToJalali(d);

  if (formatStyle === 'long') {
    const monthName = PERSIAN_MONTH_NAMES[jm - 1] || '';
    return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
  }

  const mm = String(jm).padStart(2, '0');
  const dd = String(jd).padStart(2, '0');
  return `${toPersianDigits(jy)}/${toPersianDigits(mm)}/${toPersianDigits(dd)}`;
}

/**
 * Parse a Jalali date string (e.g. "۱۴۰۵/۰۷/۱۹" or "1405-07-19" or "1405/7/19") to an ISO Gregorian string (YYYY-MM-DD)
 */
export function jalaliToIso(jalaliStr: string): string {
  const latin = toLatinDigits(jalaliStr).trim();
  const match = latin.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return jalaliStr;

  const jy = parseInt(match[1]!, 10);
  const jm = parseInt(match[2]!, 10);
  const jd = parseInt(match[3]!, 10);

  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  const isoM = String(gm).padStart(2, '0');
  const isoD = String(gd).padStart(2, '0');
  return `${gy}-${isoM}-${isoD}`;
}

/**
 * Convert a Gregorian ISO string (YYYY-MM-DD) to Jalali string
 */
export function isoToJalali(isoStr: string, formatStyle: 'short' | 'long' = 'short'): string {
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoStr;

  const gy = parseInt(match[1]!, 10);
  const gm = parseInt(match[2]!, 10);
  const gd = parseInt(match[3]!, 10);

  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);

  if (formatStyle === 'long') {
    const monthName = PERSIAN_MONTH_NAMES[jm - 1] || '';
    return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
  }

  const mm = String(jm).padStart(2, '0');
  const dd = String(jd).padStart(2, '0');
  return `${toPersianDigits(jy)}/${toPersianDigits(mm)}/${toPersianDigits(dd)}`;
}
