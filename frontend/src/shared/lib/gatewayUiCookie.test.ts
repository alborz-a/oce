import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GATEWAY_UI_COOKIE,
  claimGatewayHomeRedirect,
  clearGatewayUiCookie,
  hasGatewayUiCookie,
  setGatewayUiCookie,
} from './gatewayUiCookie';

describe('gatewayUiCookie', () => {
  beforeEach(() => {
    clearGatewayUiCookie();
    sessionStorage.clear();
  });

  afterEach(() => {
    clearGatewayUiCookie();
    sessionStorage.clear();
  });

  it('sets the oce_ui cookie so hasGatewayUiCookie is true', () => {
    expect(hasGatewayUiCookie()).toBe(false);
    setGatewayUiCookie(false);
    expect(hasGatewayUiCookie()).toBe(true);
    expect(document.cookie).toContain(`${GATEWAY_UI_COOKIE}=1`);
  });

  it('clears the cookie on clearGatewayUiCookie', () => {
    setGatewayUiCookie(true);
    clearGatewayUiCookie();
    expect(hasGatewayUiCookie()).toBe(false);
  });

  it('claims the home redirect only once per tab session', () => {
    expect(claimGatewayHomeRedirect()).toBe(true);
    expect(claimGatewayHomeRedirect()).toBe(false);
  });

  it('claims again once the previous claim is older than 60 s', () => {
    expect(claimGatewayHomeRedirect()).toBe(true);
    sessionStorage.setItem('oce_gateway_home_redirect', String(Date.now() - 61_000));
    expect(claimGatewayHomeRedirect()).toBe(true);
  });

  it('re-arms the home redirect after clearing (logout then login)', () => {
    expect(claimGatewayHomeRedirect()).toBe(true);
    clearGatewayUiCookie();
    expect(claimGatewayHomeRedirect()).toBe(true);
  });
});
