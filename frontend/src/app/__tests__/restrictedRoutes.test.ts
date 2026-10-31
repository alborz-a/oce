import { describe, it, expect } from 'vitest';
import { isRestrictedRouteAllowed as ok } from '../restrictedRoutes';

describe('isRestrictedRouteAllowed', () => {
  it('allows project, tasks, photos, documents', () => {
    for (const p of ['/projects', '/projects/abc', '/projects/abc/tasks', '/projects/abc/files', '/tasks', '/photos?x=1', '/files', '/projects/abc/']) {
      expect(ok(p)).toBe(true);
    }
  });
  it('blocks finance, ai, other modules', () => {
    for (const p of ['/dashboard', '/projects/abc/finance', '/projects/new', '/projects/abc/settings', '/ai-estimate', '/chat', '/finance', '/users', '/settings', '/']) {
      expect(ok(p)).toBe(false);
    }
  });
});
