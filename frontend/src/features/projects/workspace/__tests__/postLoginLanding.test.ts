import { describe, expect, it } from 'vitest';
import { MIZITO_GATEWAY_LANDING, resolvePostLoginLanding } from '../resolveLandingProjectRoute';

describe('post-login landing decision', () => {
  it('sends every role to the gateway /mizito/', () => {
    for (const role of ['admin', 'manager', 'editor', 'viewer', '', null, undefined]) {
      expect(resolvePostLoginLanding(role)).toBe('/mizito/');
    }
  });

  it('never returns the old hand-built project route', () => {
    expect(resolvePostLoginLanding('manager')).not.toMatch(/^\/projects/);
    expect(MIZITO_GATEWAY_LANDING).toBe('/mizito/');
  });
});
