import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { projectsApi } from '@/features/projects/api';
import { isRestrictedRouteAllowed } from './restrictedRoutes';
import { isAdminOnlyRoute } from './adminRoutes';
import { isSystemAdminRole, isManagerRole, useIsNormalUser } from '@/shared/lib/systemAdmin';
import { isNormalUserRouteAllowed } from './normalUserRoutes';

/**
 * In restricted mode a blocked route redirects to the user's project page.
 * Non-admins are also kept off admin-only routes (adminRoutes.ts).
 */
export function RestrictedRouteGuard({ children }: { children: ReactNode }) {
  const restricted = useAuthStore((s) => s.restrictedMode);
  const activeId = useProjectContextStore((s) => s.activeProjectId);
  const { pathname } = useLocation();
  const [firstId, setFirstId] = useState<string | null>(null);
  const role = useAuthStore((s) => s.userRole);
  // A known non-admin is kept off admin-only routes (role unknown is handled below).
  const adminBlocked = !!role && !isSystemAdminRole(role) && isAdminOnlyRoute(pathname);
  // Managers keep the OCE routes (owner order 2026-11-24): only non-manager normal users get the Mizito allowlist.
  const normal = useIsNormalUser() && !isManagerRole(role);
  // Normal users (not admin/manager) get the Mizito-only allowlist; admin and manager keep the existing rules.
  const blocked = normal
    ? !isNormalUserRouteAllowed(pathname)
    : (restricted && !isRestrictedRouteAllowed(pathname)) || adminBlocked;

  useEffect(() => {
    if (!blocked || activeId || firstId) return;
    let live = true;
    projectsApi
      .list()
      .then((list) => live && setFirstId(list[0]?.id ?? ''))
      .catch(() => live && setFirstId(''));
    return () => {
      live = false;
    };
  }, [blocked, activeId, firstId]);

  // Role not known yet: render nothing. The page element is never mounted, so
  // no OCE page can paint before the role decides (no flash, no lazy chunk fetch).
  if (!role) return null;
  if (!blocked) return <>{children}</>;
  const id = activeId || firstId;
  if (id === null) return null; // still looking up the project
  return <Navigate to={id ? `/projects/${id}` : '/projects'} replace />;
}
