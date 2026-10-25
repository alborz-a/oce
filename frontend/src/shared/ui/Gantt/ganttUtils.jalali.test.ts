import { describe, expect, it } from 'vitest';
import { generateTimeHeaders, getLockedWeekendDays } from './ganttUtils';

describe('ganttUtils Jalali headers (REGION_LOCK)', () => {
  it('day view: Jalali month on top, Persian day digits below', () => {
    const h = generateTimeHeaders(new Date(2026, 9, 13), new Date(2026, 9, 15), 'day', 'fa-IR');
    expect(h.topRow[0]!.label).toBe('مهر ۱۴۰۵');
    expect(h.bottomRow.map((c) => c.label)).toEqual(['۲۱', '۲۲', '۲۳']);
  });

  it('month view: Jalali year on top, month names below', () => {
    const h = generateTimeHeaders(new Date(2026, 9, 13), new Date(2026, 11, 25), 'month', 'fa-IR');
    expect(h.topRow[0]!.label).toBe('۱۴۰۵');
    expect(h.bottomRow.map((c) => c.label)).toEqual(['مهر', 'آبان', 'آذر', 'دی']);
  });

  it('week view: weeks begin on Saturday', () => {
    const h = generateTimeHeaders(new Date(2026, 9, 13), new Date(2026, 9, 31), 'week', 'fa-IR');
    // 2026-10-17 is a Saturday
    expect(h.bottomRow[0]!.x).toBeCloseTo((4 / 7) * 40);
    expect(h.bottomRow[0]!.label).toBe('هفته ۱');
  });

  it('week view: every week header uses Persian digits, no Latin digits', () => {
    const h = generateTimeHeaders(new Date(2026, 9, 13), new Date(2026, 11, 31), 'week', 'fa-IR');
    expect(h.bottomRow.length).toBeGreaterThanOrEqual(10);
    expect(h.bottomRow[9]!.label).toBe('هفته ۱۰');
    for (const c of h.bottomRow) expect(c.label).not.toMatch(/[0-9]/);
  });

  it('weekend is Friday, not Saturday', () => {
    const days = getLockedWeekendDays(new Date(2026, 9, 13), new Date(2026, 9, 31));
    expect(days.every((d) => d.getDay() === 5)).toBe(true);
    expect(days.map((d) => d.getDate())).toEqual([16, 23, 30]);
  });
});
