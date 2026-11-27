/**
 * `oce_ui` cookie: tells nginx to serve the gateway shell at `/` (OCE SPA otherwise).
 * Holds no secret. Path=/, SameSite=Lax, Secure on https, not HttpOnly.
 * Remember-me on = Max-Age 30 days; off = session cookie.
 */
export const GATEWAY_UI_COOKIE = 'oce_ui';

const REMEMBER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const REDIRECT_FLAG = 'oce_gateway_home_redirect';

function secureAttr(): string {
  return typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
}

export function hasGatewayUiCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((part) => part.trim().startsWith(`${GATEWAY_UI_COOKIE}=`));
}

export function setGatewayUiCookie(remember: boolean): void {
  if (typeof document === 'undefined') return;
  const maxAge = remember ? `; Max-Age=${REMEMBER_MAX_AGE_SECONDS}` : '';
  document.cookie = `${GATEWAY_UI_COOKIE}=1; Path=/; SameSite=Lax${maxAge}${secureAttr()}`;
}

/** Logout / 401 / session drop: remove the cookie and the one-shot redirect flag. */
export function clearGatewayUiCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${GATEWAY_UI_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secureAttr()}`;
  }
  try {
    sessionStorage.removeItem(REDIRECT_FLAG);
  } catch {
    // sessionStorage unavailable -- ignore.
  }
}

/**
 * Guard for the `/` redirect: true if no claim happened in the last 60 s (per tab session).
 * A stale claim no longer blocks it for the rest of the tab session, so `/` never spins for good.
 * If sessionStorage is unavailable it returns false, so no redirect loop can start.
 */
export function claimGatewayHomeRedirect(): boolean {
  try {
    const last = Number(sessionStorage.getItem(REDIRECT_FLAG)) || 0;
    if (last && Date.now() - last < 60_000) return false;
    sessionStorage.setItem(REDIRECT_FLAG, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * Login success that ends in the gateway: set the routing cookie and blank the page
 * BEFORE the auth store flips, so the SPA never paints its own dashboard/projects page
 * for the moment before the full page load to `/`.
 */
export function beginGatewayHandoff(remember: boolean): void {
  if (typeof document === 'undefined') return;
  setGatewayUiCookie(remember);
  document.documentElement.style.visibility = 'hidden';
}
