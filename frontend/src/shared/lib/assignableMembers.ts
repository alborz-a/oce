import { isImporter } from '@/features/projects/workspace/lib/importerAuthor';

/**
 * Members that may be picked as task assignee / responsible.
 * Drops deactivated accounts (is_active === false) and accounts whose email
 * ends with `.invalid` (deleted users). Undefined is_active counts as active.
 */
export interface AssignableMemberLike {
  email?: string | null;
  full_name?: string | null;
  is_active?: boolean;
  user_id?: string | number | null;
  id?: string | number | null;
}

export function assignableMembers<T extends AssignableMemberLike>(members: T[]): T[] {
  return members.filter((m) => {
    if (m.is_active === false) return false;
    if (isImporter(m.user_id ?? m.id)) return false;
    const email = (m.email ?? '').trim().toLowerCase();
    if (email.endsWith('.invalid')) return false;
    return Boolean(m.full_name?.trim() || email);
  });
}

/** Option label for a member: full name, falling back to email. */
export function memberLabel(m: AssignableMemberLike): string {
  return m.full_name?.trim() || m.email || '';
}
