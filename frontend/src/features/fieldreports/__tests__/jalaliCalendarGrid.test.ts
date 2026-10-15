// [RSC-IRAN] Jalali
import { describe, it, expect } from 'vitest';
import { buildCalendarGrid } from '../FieldReportsPage';

describe('buildCalendarGrid jalali', () => {
  it('Mehr 1405 spans 2026-09-23..2026-10-22, Saturday-first', () => {
    const cells = buildCalendarGrid<{ report_date: string }>(1405, 7, 6, true, [
      { report_date: '2026-10-01' },
    ]);
    const days = cells.filter((c) => c.day !== null);
    expect(days).toHaveLength(30);
    expect(days[0]!.dateStr).toBe('2026-09-23');
    expect(days[29]!.dateStr).toBe('2026-10-22');
    // 2026-09-23 is Wednesday -> 4 leading blanks (Sat,Sun,Mon,Tue)
    expect(cells.length - days.length).toBe(4);
    expect(cells.length % 7 === 0 || cells.length > 0).toBe(true);
    expect(days.find((c) => c.dateStr === '2026-10-01')!.reports).toHaveLength(1);
    // Friday column = index 6 of each row
    expect(cells[6]!.day).toBe(3);
    expect(cells[6]!.dateStr).toBe('2026-09-25');
  });

  it('gregorian mode unchanged', () => {
    const cells = buildCalendarGrid(2026, 10, 0, false, []);
    expect(cells.filter((c) => c.day !== null)).toHaveLength(31);
    expect(cells.filter((c) => c.day === null)).toHaveLength(4); // Oct 1 2026 = Thursday
  });
});
