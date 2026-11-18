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

/** Roles allowed to enter the engineering (OCE) mode: `admin` and `manager`. */
export function isEngineeringRole(role: string | null | undefined): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r === 'admin' || r === 'manager';
}

/** Normal user = a known role that is not admin/manager. Unknown role is not normal (not yet resolved). */
export function isNormalUserRole(role: string | null | undefined): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r !== '' && !isEngineeringRole(r);
}

/** Reactive hook: true for a normal user (Mizito-only landing and menus). */
export function useIsNormalUser(): boolean {
  return useAuthStore((s) => isNormalUserRole(s.userRole));
}
