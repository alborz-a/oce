// [RSC-IRAN] Unit tests for restrictedRoutes allowlist
import { describe, it, expect } from 'vitest';
import { isRestrictedRouteAllowed as ok } from '../restrictedRoutes';

describe('isRestrictedRouteAllowed', () => {
  it('allows four shell areas, login and profile', () => {
    for (const p of [
      '/',
      '/login',
      '/profile',
      '/projects',
      '/projects/abc',
      '/projects/abc/',
      '/projects/abc?tab=photos',
      '/projects/abc/tasks',
      '/projects/abc/files',
      '/projects/abc/chat',
      '/photos',
      '/photos?x=1',
      '/files',
      '/files/detail/p1/f1',
      '/documents',
      '/tasks',
      '/chat',
      '/chat/room1',
      '/chat/general?filter=all',
    ]) {
      expect(ok(p)).toBe(true);
    }
  });

  it('blocks disallowed routes including dashboard, notifications, onboarding, settings', () => {
    for (const p of [
      '/dashboard',
      '/notifications',
      '/onboarding',
      '/projects/new',
      '/projects/abc/finance',
      '/projects/abc/settings',
      '/finance',
      '/ai-estimate',
      '/users',
      '/settings',
      '/about',
    ]) {
      expect(ok(p)).toBe(false);
    }
  });
});
