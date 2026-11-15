import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const spies = vi.hoisted(() => ({
  apiGet: vi.fn((url: unknown) => Promise.resolve(String(url).includes('/modules') ? [] : {})),
  fetchSavedViews: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  fetchFavorites: vi.fn().mockResolvedValue([]),
  getProfile: vi.fn().mockResolvedValue(null),
  listProjects: vi.fn().mockResolvedValue([{ id: 'p-1', name: 'Proj', created_at: '2026-01-01', updated_at: '2026-01-01' }]),
  listBoqs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/shared/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/api')>('@/shared/lib/api');
  return { ...actual, apiGet: (...args: unknown[]) => spies.apiGet(...args) };
});

vi.mock('@/features/file-saved-views/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/file-saved-views/api')>(
    '@/features/file-saved-views/api',
  );
  return { ...actual, fetchSavedViews: (...args: unknown[]) => spies.fetchSavedViews(...args) };
});

vi.mock('@/features/file-manager/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/file-manager/api')>(
    '@/features/file-manager/api',
  );
  return { ...actual, fetchFavorites: (...args: unknown[]) => spies.fetchFavorites(...args) };
});

vi.mock('@/features/projects/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/projects/api')>(
    '@/features/projects/api',
  );
  return {
    ...actual,
    projectsApi: {
      ...actual.projectsApi,
      list: (...args: unknown[]) => spies.listProjects(...args),
      getProfile: (...args: unknown[]) => spies.getProfile(...args),
    },
  };
});

vi.mock('@/features/boq/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/boq/api')>('@/features/boq/api');
  return {
    ...actual,
    boqApi: {
      ...actual.boqApi,
      list: (...args: unknown[]) => spies.listBoqs(...args),
    },
  };
});

import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { useResolvedGuides } from '@/shared/ui/guideOverrides';
import { useSavedViews } from '@/features/file-saved-views/hooks';
import { useFavorites } from '@/features/file-manager/hooks';
import { useActiveProjectProfile } from '@/features/projects/useProjectProfile';
import { CommandPalette } from '@/shared/ui/CommandPalette';

function Probe() {
  useResolvedGuides();
  useSavedViews('p-1');
  useFavorites('p-1');
  useActiveProjectProfile();
  return <CommandPalette open onClose={() => {}} />;
}

describe('restricted mode suppresses 403-prone queries (rsd-rsc#90)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useAuthStore.setState({ restrictedMode: false, profileResolved: false });
    useProjectContextStore.setState({ activeProjectId: null });
  });

  it('skips admin-only hooks and CommandPalette BOQ preload when restrictedMode=true', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    useAuthStore.setState({ isAuthenticated: true, restrictedMode: true, profileResolved: true, userRole: 'viewer' });
    useProjectContextStore.setState({ activeProjectId: 'p-1' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(spies.listProjects).toHaveBeenCalledTimes(1));
    expect(spies.apiGet).not.toHaveBeenCalled();
    expect(spies.fetchSavedViews).not.toHaveBeenCalled();
    expect(spies.fetchFavorites).not.toHaveBeenCalled();
    expect(spies.getProfile).not.toHaveBeenCalled();
    expect(spies.listBoqs).not.toHaveBeenCalled();
  });

  it('allows queries when restrictedMode=false', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    useAuthStore.setState({ isAuthenticated: true, restrictedMode: false, profileResolved: true, userRole: 'admin' });
    useProjectContextStore.setState({ activeProjectId: 'p-1' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(spies.listBoqs).toHaveBeenCalledTimes(1));
    expect(spies.apiGet).toHaveBeenCalledWith('/v1/guide-overrides/');
    expect(spies.fetchSavedViews).toHaveBeenCalled();
    expect(spies.fetchFavorites).toHaveBeenCalledWith('p-1');
    expect(spies.getProfile).toHaveBeenCalledWith('p-1');
  });
});
