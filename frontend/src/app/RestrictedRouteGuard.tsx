import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { projectsApi } from '@/features/projects/api';
import { isRestrictedRouteAllowed } from './restrictedRoutes';

/**
 * In restricted mode a blocked route redirects to the user's project page.
 * Unrestricted users pass straight through.
 */
export function RestrictedRouteGuard({ children }: { children: ReactNode }) {
  const restricted = useAuthStore((s) => s.restrictedMode);
  const activeId = useProjectContextStore((s) => s.activeProjectId);
  const { pathname } = useLocation();
  const [firstId, setFirstId] = useState<string | null>(null);
  const blocked = restricted && !isRestrictedRouteAllowed(pathname);

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
