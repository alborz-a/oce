// [RSC-IRAN] Step 5.2: Per-project role capabilities hook
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';

export interface ProjectCapsResponse {
  project_id: string;
  my_project_role: string;
  my_caps: string[];
}

export interface UseProjectCapsResult {
  role: string | null;
  caps: string[];
  can: (cap: string) => boolean;
  isLoading: boolean;
}

export function useProjectCaps(projectId: string | null | undefined): UseProjectCapsResult {
  const { data, isLoading } = useQuery<ProjectCapsResponse>({
    queryKey: ['project-caps', projectId],
    queryFn: () => apiGet<ProjectCapsResponse>(`/v1/users/me/projects/${projectId}/caps`),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
  });

  const role = data?.my_project_role ?? null;
  const caps = useMemo(() => data?.my_caps ?? [], [data?.my_caps]);
  const capSet = useMemo(() => new Set(caps), [caps]);

  const can = useCallback(
    (cap: string) => {
      if (isLoading || !data) return false;
      return capSet.has(cap);
    },
    [isLoading, data, capSet],
  );

  return {
    role,
    caps,
    can,
    isLoading,
  };
}
