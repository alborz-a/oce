/**
 * Routes only the system admin (role `admin`) may open. Used by
 * RestrictedRouteGuard. Hiding a menu row is not access control; the backend
 * keeps its own role checks on the matching writes.
 */
const ADMIN_ONLY: RegExp[] = [
  /^\/users$/,
  /^\/admin(\/.*)?$/,
  /^\/governance$/,
  /^\/modules(\/.*)?$/,
  /^\/module-builder$/,
  /^\/setup\/databases$/,
  /^\/integrations$/,
  /^\/jobs$/,
  /^\/costs\/import$/,
  /^\/files\/trash$/,
  /^\/chat\/admin$/,
  /^\/geo(-hub)?\/admin$/,
  /^\/property-dev\/(admin|settings)(\/.*)?$/,
  /^\/about$/,
  /^\/settings(\/.*)?$/,
  /^\/profile$/,
  /^\/chat$/,
  /^\/advisor$/,
  /^\/ai-(estimate|estimator|agents)$/,
  /^\/estimate-copilot$/,
  /^\/styles-lab$/,
  /^\/match-elements$/,
  /^\/(projects\/[^/]+\/)?connectors$/,
];

export function isAdminOnlyRoute(to: string): boolean {
  const path = to.split(/[?#]/)[0]!.replace(/(.)\/+$/, '$1');
  return ADMIN_ONLY.some((re) => re.test(path));
}
