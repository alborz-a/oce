import { describe, it, expect } from 'vitest';
import { isRestrictedRouteAllowed as ok } from '../restrictedRoutes';

describe('isRestrictedRouteAllowed', () => {
  it('allows project, tasks, files, chat, meetings, schedule, timeline, photos, documents', () => {
    for (const p of [
      '/projects',
      '/projects/abc',
      '/projects/abc/tasks',
      '/projects/abc/files',
      '/projects/abc/chat',
      '/projects/abc/correspondence',
      '/projects/abc/correspondence/',
      '/projects/abc/chat/room-1',
      '/projects/abc/meetings',
      '/projects/abc/schedule',
      '/projects/abc/timeline',
      '/files/detail/p1/f1',
      '/projects/abc?tab=photos',
      '/photos',
      '/tasks',
      '/photos?x=1',
      '/files',
      '/projects/abc/',
      '/',
      '/dashboard',
      '/notifications',
      '/profile',
      '/colleagues',
      '/colleagues/abc',
    ]) {
      expect(ok(p)).toBe(true);
    }
  });
  it('blocks finance, ai, other modules', () => {
    for (const p of ['/projects/abc/finance', '/projects/new', '/projects/abc/settings', '/ai-estimate', '/chat', '/finance', '/users', '/settings', '/about', '/onboarding']) {
      expect(ok(p)).toBe(false);
    }
  });
});
