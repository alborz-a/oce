import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIsSystemAdmin } from '@/shared/lib/systemAdmin';

interface MemberRow {
  user_id: string;
  role?: string;
}

function tokenClaims(token: string | null): { sub?: string; role?: string } {
  try {
    const part = (token?.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return {};
  }
}

/**
 * Whether the signed-in user may add photos and edit descriptions in a project.
 * Global managers read every project but only write where they are team members,
 * so they get the controls only after the member list shows them. Everyone else
 * keeps the controls (the backend still decides).
 */
export function useCanWritePhotos(projectId: string | null | undefined): boolean {
  const token = useAuthStore((s) => s.accessToken);
  const { sub, role } = tokenClaims(token);
  const isManager = role === 'manager';
  const { data: members } = useQuery<MemberRow[]>({
    queryKey: ['project-members', projectId],
    queryFn: () => apiGet<MemberRow[]>(`/v1/projects/${projectId}/members/`),
    enabled: isManager && !!projectId,
    staleTime: 30_000,
  });
  if (!isManager) return true;
  return !!sub && !!members?.some((m) => m.user_id === sub);
}

/**
 * Whether the signed-in user may edit a photo's description (E3): the system
 * admin, the uploader of that photo, or a project manager of the project
 * (team role `project_manager`). Mirrors the backend PATCH rule in
 * `documents/router.py` `update_photo`.
 */
export function useCanEditPhotoCaption(
  projectId: string | null | undefined,
  uploaderId: string | null | undefined,
): boolean {
  const token = useAuthStore((s) => s.accessToken);
  const { sub } = tokenClaims(token);
  const isAdmin = useIsSystemAdmin();
  const { data: members } = useQuery<MemberRow[]>({
    queryKey: ['project-members', projectId],
    queryFn: () => apiGet<MemberRow[]>(`/v1/projects/${projectId}/members/`),
    enabled: !isAdmin && !!sub && !!projectId,
    staleTime: 30_000,
  });
  if (isAdmin) return true;
  if (!sub) return false;
  if (uploaderId && uploaderId === sub) return true;
  return !!members?.some((m) => m.user_id === sub && m.role === 'project_manager');
}
