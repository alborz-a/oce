import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';

interface MemberRow {
  user_id: string;
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
