import { useAuthStore } from '@/stores/useAuthStore';

/**
 * "System admin" = the backend role `admin`, the top of ROLE_HIERARCHY
 * (there is no separate `superuser` role). Managers and project managers
 * are NOT system admins. The one place the frontend decides this.
 */
export function isSystemAdminRole(role: string | null | undefined): boolean {
  return (role ?? '').trim().toLowerCase() === 'admin';
}

/** Reactive hook for components. */
export function useIsSystemAdmin(): boolean {
  return useAuthStore((s) => isSystemAdminRole(s.userRole));
}
