import { describe, it, expect } from 'vitest';
import { isProjectWidgetAvailable } from './projectWidgetRegistry';
import { canOpenRoute } from '@/shared/lib/canOpenRoute';

const mk = (role: string, restricted: boolean) => (to?: string | null) =>
  canOpenRoute(to, { role, restricted });

describe('isProjectWidgetAvailable', () => {
  it('hides commercial cards for restricted staff', () => {
    const c = mk('editor', true);
    for (const id of ['rfi-inbox', 'change-orders', 'variations']) {
      expect(isProjectWidgetAvailable(id, c, false)).toBe(false);
    }
    expect(isProjectWidgetAvailable('recent-files', c, false)).toBe(true);
    expect(isProjectWidgetAvailable('photo-strip', c, false)).toBe(true);
  });
  it('hides activity and ai insights for non-admins', () => {
    const c = mk('manager', false);
    expect(isProjectWidgetAvailable('activity-feed', c, false)).toBe(false);
    expect(isProjectWidgetAvailable('ai-insights', c, false)).toBe(false);
    expect(isProjectWidgetAvailable('health-bar', c, false)).toBe(false);
    expect(isProjectWidgetAvailable('rfi-inbox', c, false)).toBe(true);
  });
  it('shows everything to admin', () => {
    const c = mk('admin', false);
    expect(isProjectWidgetAvailable('activity-feed', c, true)).toBe(true);
    expect(isProjectWidgetAvailable('rfi-inbox', c, true)).toBe(true);
  });
});
