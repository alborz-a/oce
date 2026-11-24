import { fetchProjectList } from '@/shared/lib/projectList';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

export const LAST_ACTIVE_PROJECT_STORAGE_KEY = 'mz_last_active_project_id';

export interface LandingProjectSummary {
  id: string;
  name?: string;
  status?: string;
}

export function readLastActiveProjectId(): string | null {
  try {
    const stored = window.localStorage.getItem(LAST_ACTIVE_PROJECT_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // Ignore localStorage access errors in private/restricted environments.
  }
  return useProjectContextStore.getState().activeProjectId;
}

export function saveLastActiveProjectId(projectId: string, projectName?: string): void {
  try {
    window.localStorage.setItem(LAST_ACTIVE_PROJECT_STORAGE_KEY, projectId);
  } catch {
    // Ignore localStorage access errors.
  }
  if (projectName !== undefined) {
    useProjectContextStore.getState().setActiveProject(projectId, projectName);
  }
}

export function pickLandingProject<T extends LandingProjectSummary>(
  projects: readonly T[],
  preferredId?: string | null,
): T | null {
  if (projects.length === 0) return null;
  if (preferredId) {
    const matched = projects.find((p) => p.id === preferredId);
    if (matched) return matched;
  }
  const nonArchived = projects.filter(
    (p) => (p.status ?? '').trim().toLowerCase() !== 'archived',
  );
  const pool = nonArchived.length > 0 ? nonArchived : projects;
  const edari = pool.find((p) => (p.name ?? '').includes('پیگیری اداری'));
  return edari ?? pool[0] ?? null;
}

/** Full gateway section (new Mizito app, services/mizito-gw). Every role lands here after login. */
export const GATEWAY_LANDING = '/';

/**
 * Post-login landing decision: every role goes to the gateway, never to the old hand-built shell.
 * Caller must do a full page load (window.location.assign), not a router navigate.
 */
export function resolvePostLoginLanding(_role?: string | null): string {
  return GATEWAY_LANDING;
}

export async function resolveLandingProjectRoute(): Promise<string> {
  try {
    const projects = await fetchProjectList<LandingProjectSummary[]>();
    if (!Array.isArray(projects) || projects.length === 0) {
      return '/projects';
    }
    const picked = pickLandingProject(projects, readLastActiveProjectId());
    if (!picked) {
      return '/projects';
    }
    saveLastActiveProjectId(picked.id, picked.name ?? '');
    return `/projects/${picked.id}`;
  } catch {
    return '/projects';
  }
}
