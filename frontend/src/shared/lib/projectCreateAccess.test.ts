import { describe, expect, it } from 'vitest';
import { canCreateProject } from './projectCreateAccess';

describe('canCreateProject', () => {
  it('allows admin and manager', () => {
    expect(canCreateProject('admin')).toBe(true);
    expect(canCreateProject('manager')).toBe(true);
    expect(canCreateProject(' Manager ')).toBe(true);
  });

  it('denies staff and unknown roles', () => {
    expect(canCreateProject('editor')).toBe(false);
    expect(canCreateProject('viewer')).toBe(false);
    expect(canCreateProject('project_manager')).toBe(false);
    expect(canCreateProject('')).toBe(false);
    expect(canCreateProject(null)).toBe(false);
    expect(canCreateProject(undefined)).toBe(false);
  });
});
