/**
 * Route allowlist for restricted project-user mode.
 *
 * One list, used by the sidebar (hide rows) and by RestrictedRouteGuard
 * (redirect). Hiding a row is not access control; the backend still checks.
 */
const ALLOWED: RegExp[] = [
  /^\/projects$/,
  /^\/projects\/(?!new(?:\/|$))[^/]+$/,
  /^\/projects\/[^/]+\/(tasks|files)$/,
  /^\/tasks$/,
  /^\/photos$/,
  /^\/files$/,
  /^\/documents$/,
];

/** True when `to` (path, optional ?query / #hash) is open to a restricted user. */
export function isRestrictedRouteAllowed(to: string): boolean {
  const path = to.split(/[?#]/)[0]!.replace(/(.)\/+$/, '$1');
  return ALLOWED.some((re) => re.test(path));
}
