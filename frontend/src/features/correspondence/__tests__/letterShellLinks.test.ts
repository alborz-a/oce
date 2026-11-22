import { describe, it, expect } from 'vitest';
import { isShellSafePath } from '../letterShellLinks';
import { isRestrictedRouteAllowed } from '@/app/restrictedRoutes';

describe('isShellSafePath (letters links)', () => {
  it('keeps letters and project workspace links inside the shell', () => {
    expect(isShellSafePath('/correspondence')).toBe(true);
    expect(isShellSafePath('/projects/p1')).toBe(true);
    expect(isShellSafePath('/projects/p1/correspondence')).toBe(true);
  });

  it('blocks raw OCE pages reached from letters, with or without a query', () => {
    expect(isShellSafePath('/contacts')).toBe(false);
    expect(isShellSafePath('/contacts?contactId=abc')).toBe(false);
    expect(isShellSafePath('/rfi')).toBe(false);
    expect(isShellSafePath('/rfi/abc')).toBe(false);
    expect(isShellSafePath('/transmittals')).toBe(false);
    expect(isShellSafePath('/projects/new')).toBe(false);
  });
});

describe('restricted allowlist for the global letters route', () => {
  it('allows /correspondence for staff', () => {
    expect(isRestrictedRouteAllowed('/correspondence')).toBe(true);
    expect(isRestrictedRouteAllowed('/correspondence/')).toBe(true);
  });
});
