import { useAuthStore } from '@/stores/useAuthStore';
import { isRestrictedRouteAllowed } from '@/app/restrictedRoutes';
import { isAdminOnlyRoute } from '@/app/adminRoutes';
import { isSystemAdminRole } from '@/shared/lib/systemAdmin';

/**
 * The one place that decides whether a user may open a route. Mirrors
 * RestrictedRouteGuard: restricted users only get the restricted allowlist,
 * and non-admins never get admin-only routes. Pure and computed at render
 * time (no persisted state), so access granted later brings a card back.
 */
export function canOpenRoute(
  to: string | null | undefined,
  user: { role: string | null | undefined; restricted: boolean },
): boolean {
  if (!to) return true;
  if (user.restricted && !isRestrictedRouteAllowed(to)) return false;
  // A role not yet known is let through (the backend still refuses), as in the guard.
  if (!!user.role && !isSystemAdminRole(user.role) && isAdminOnlyRoute(to)) return false;
  return true;
}

/** Reactive hook: returns a predicate for the current user. */
export function useCanOpenRoute(): (to: string | null | undefined) => boolean {
  const role = useAuthStore((s) => s.userRole);
  const restricted = useAuthStore((s) => s.restrictedMode);
  return (to) => canOpenRoute(to, { role, restricted: !!restricted });
}
