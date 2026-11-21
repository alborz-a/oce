/**
 * Route allowlist for normal users (role is not admin/manager).
 *
 * A normal user sees only the Mizito shell: the project workspace, correspondence,
 * the profile page (wrapped in Mizito chrome) and the project list fallback
 * used when no project is accessible. Everything else redirects to the landing.
 * Admin and manager keep the full app, so this list is never applied to them.
 */
const ALLOWED: RegExp[] = [
  /^\/projects$/,
  /^\/projects\/(?!new(?:\/|$))[^/]+$/,
  /^\/projects\/[^/]+\/correspondence(?:\/.*)?$/,
  /^\/correspondence$/,
  /^\/profile$/,
  /^\/notes$/,
  /^\/colleagues(?:\/[^/]+)?$/,
  /^\/customers$/,
  /^\/monitoring$/,
];

/** True when `to` (path, optional ?query / #hash) is open to a normal user. */
export function isNormalUserRouteAllowed(to: string): boolean {
  const path = to.split(/[?#]/)[0]!.replace(/(.)\/+$/, '$1');
  return ALLOWED.some((re) => re.test(path));
}
