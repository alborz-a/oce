import { describe, expect, it } from 'vitest';
import { fmtDate, formatDateValue, formatJalaliWithOptions } from './formatters';

describe('date formatters under REGION_LOCK', () => {
  it('fmtDate renders 2026-10-13 as Jalali with Persian digits', () => {
    expect(fmtDate('2026-10-13', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('۱۴۰۵/۰۷/۲۱');
  });
  it('month name is مهر', () => {
    expect(fmtDate('2026-10-13', { month: 'long' })).toBe('مهر');
    expect(formatDateValue('2026-10-13', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('۲۱ مهر ۱۴۰۵');
  });
  it('time options fall back to Intl', () => {
    expect(formatJalaliWithOptions('2026-10-13T10:00:00Z', { hour: '2-digit' })).toBeNull();
  });
});
