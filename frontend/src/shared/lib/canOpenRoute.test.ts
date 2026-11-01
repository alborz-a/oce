import { describe, it, expect } from 'vitest';
import { canOpenRoute } from './canOpenRoute';

const admin = { role: 'admin', restricted: false };
const staff = { role: 'editor', restricted: true };
const normal = { role: 'manager', restricted: false };

describe('canOpenRoute', () => {
  it('lets admin open everything', () => {
    expect(canOpenRoute('/rfi', admin)).toBe(true);
    expect(canOpenRoute('/ai-agents', admin)).toBe(true);
  });
  it('blocks restricted staff from non-allowlisted routes', () => {
    expect(canOpenRoute('/rfi', staff)).toBe(false);
    expect(canOpenRoute('/changeorders', staff)).toBe(false);
    expect(canOpenRoute('/variations', staff)).toBe(false);
    expect(canOpenRoute('/files', staff)).toBe(true);
    expect(canOpenRoute('/projects/p1?tab=photos', staff)).toBe(true);
  });
  it('blocks non-admins from admin-only routes', () => {
    expect(canOpenRoute('/ai-agents', normal)).toBe(false);
    expect(canOpenRoute('/rfi', normal)).toBe(true);
  });
  it('is recomputed per call so granted access returns', () => {
    expect(canOpenRoute('/rfi', staff)).toBe(false);
    expect(canOpenRoute('/rfi', { role: 'editor', restricted: false })).toBe(true);
  });
  it('allows empty target and unknown role', () => {
    expect(canOpenRoute(null, staff)).toBe(true);
    expect(canOpenRoute('/ai-agents', { role: null, restricted: false })).toBe(true);
  });
});
