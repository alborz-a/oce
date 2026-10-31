import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { projectsApi } from '@/features/projects/api';
import { isRestrictedRouteAllowed } from './restrictedRoutes';
import { isAdminOnlyRoute } from './adminRoutes';
import { isSystemAdminRole } from '@/shared/lib/systemAdmin';

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
  // A role not yet known is let through (the backend still refuses); a known non-admin is not.
  const adminBlocked = !!role && !isSystemAdminRole(role) && isAdminOnlyRoute(pathname);
  const blocked = (restricted && !isRestrictedRouteAllowed(pathname)) || adminBlocked;

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

  if (!blocked) return <>{children}</>;
  const id = activeId || firstId;
  if (id === null) return null; // still looking up the project
  return <Navigate to={id ? `/projects/${id}` : '/projects'} replace />;
}
