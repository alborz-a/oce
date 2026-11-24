import { describe, expect, it } from 'vitest';
import { GATEWAY_LANDING, resolvePostLoginLanding } from '../resolveLandingProjectRoute';

describe('post-login landing decision', () => {
  it('sends every role to the gateway at /', () => {
    for (const role of ['admin', 'manager', 'editor', 'viewer', '', null, undefined]) {
      expect(resolvePostLoginLanding(role)).toBe('/');
    }
  });

  it('never returns the old hand-built project route', () => {
    expect(resolvePostLoginLanding('manager')).not.toMatch(/^\/projects/);
    expect(GATEWAY_LANDING).toBe('/');
  });
});
