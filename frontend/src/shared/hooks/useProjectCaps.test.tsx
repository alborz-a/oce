// [RSC-IRAN] Unit tests for useProjectCaps hook
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('@/shared/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/api')>()),
  apiGet: (...a: unknown[]) => api.apiGet(...a),
}));

import { useProjectCaps } from './useProjectCaps';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  api.apiGet.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useProjectCaps', () => {
  it('returns role, caps, and can() helper when loaded', async () => {
    api.apiGet.mockResolvedValue({
      project_id: 'p1',
      my_project_role: 'estimator',
      my_caps: ['photos.view', 'photos.upload', 'task.view'],
    });

    const { result } = renderHook(() => useProjectCaps('p1'), { wrapper });

    // Initially loading or without data, can() returns false
    expect(result.current.can('photos.view')).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.apiGet).toHaveBeenCalledWith('/v1/users/me/projects/p1/caps');
    expect(result.current.role).toBe('estimator');
    expect(result.current.caps).toEqual(['photos.view', 'photos.upload', 'task.view']);
    expect(result.current.can('photos.view')).toBe(true);
    expect(result.current.can('photos.upload')).toBe(true);
    expect(result.current.can('members.manage')).toBe(false);
  });

  it('handles empty/null projectId without making api calls', () => {
    const { result } = renderHook(() => useProjectCaps(null), { wrapper });
    expect(result.current.role).toBe(null);
    expect(result.current.caps).toEqual([]);
    expect(result.current.can('anything')).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(api.apiGet).not.toHaveBeenCalled();
  });

  it('returns false for can() when api call fails', async () => {
    api.apiGet.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useProjectCaps('p1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role).toBe(null);
    expect(result.current.can('photos.view')).toBe(false);
  });
});
