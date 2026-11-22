import { describe, expect, it } from 'vitest';
import { canSeeGantt } from '../ganttAccess';

describe('canSeeGantt', () => {
  it('allows global admin and manager', () => {
    expect(canSeeGantt('admin')).toBe(true);
    expect(canSeeGantt('manager')).toBe(true);
  });

  it('denies editor, viewer, project_manager, empty and missing roles', () => {
    expect(canSeeGantt('editor')).toBe(false);
    expect(canSeeGantt('viewer')).toBe(false);
    expect(canSeeGantt('project_manager')).toBe(false);
    expect(canSeeGantt('')).toBe(false);
    expect(canSeeGantt(null)).toBe(false);
    expect(canSeeGantt(undefined)).toBe(false);
  });
});
