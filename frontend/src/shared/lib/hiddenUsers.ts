import { useMemo } from 'react';
import { useIsSystemAdmin } from '@/shared/lib/systemAdmin';

/**
 * The migration service account ("Mizito Importer") owns the imported
 * projects but is not a real person. Only the system admin sees it.
 */
const IMPORTER_EMAIL = 'mizito-importer@royalstars.co';
const IMPORTER_NAME = 'mizito importer';

export function isHiddenSystemUser(u: {
  email?: string | null;
  full_name?: string | null;
}): boolean {
  return (
    (u.email ?? '').trim().toLowerCase() === IMPORTER_EMAIL ||
    (u.full_name ?? '').trim().toLowerCase() === IMPORTER_NAME
  );
}

interface MemberLike {
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_owner?: boolean;
}

/**
 * Drop the importer account for non-admins. When it was the displayed owner
 * (is_owner), the project_manager member is shown as owner instead.
 */
export function visibleMembers<T extends MemberLike>(members: T[], isAdmin: boolean): T[] {
  if (isAdmin) return members;
  const kept = members.filter((m) => !isHiddenSystemUser(m));
  if (kept.length === members.length) return members;
  const lostOwner = members.some((m) => m.is_owner && isHiddenSystemUser(m));
  if (!lostOwner || kept.some((m) => m.is_owner)) return kept;
  const pmIndex = kept.findIndex((m) => (m.role ?? '').toLowerCase() === 'project_manager');
  if (pmIndex === -1) return kept;
  return kept.map((m, i) => (i === pmIndex ? { ...m, is_owner: true } : m));
}

/** Hook form for components. */
export function useVisibleMembers<T extends MemberLike>(members: T[]): T[] {
  const isAdmin = useIsSystemAdmin();
  return useMemo(() => visibleMembers(members, isAdmin), [members, isAdmin]);
}
