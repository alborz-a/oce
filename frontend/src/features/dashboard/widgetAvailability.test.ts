import { describe, it, expect } from 'vitest';
import { isDashboardWidgetAvailable } from './widgetRegistry';
import { canOpenRoute } from '@/shared/lib/canOpenRoute';

const staff = (to?: string | null) => canOpenRoute(to, { role: 'editor', restricted: true });
const admin = (to?: string | null) => canOpenRoute(to, { role: 'admin', restricted: false });

describe('isDashboardWidgetAvailable', () => {
  it('hides cards whose target staff cannot open', () => {
    for (const id of ['rfi_turnaround', 'finance_summary', 'bim_coverage', 'submittals_pending']) {
      expect(isDashboardWidgetAvailable(id, staff)).toBe(false);
    }
  });
  it('keeps cards staff can open and unlinked cards', () => {
    expect(isDashboardWidgetAvailable('projects', staff)).toBe(true);
    expect(isDashboardWidgetAvailable('latest_photos', staff)).toBe(true);
    expect(isDashboardWidgetAvailable('regional_pack', staff)).toBe(true);
  });
  it('shows everything to admin', () => {
    expect(isDashboardWidgetAvailable('rfi_turnaround', admin)).toBe(true);
  });
});
