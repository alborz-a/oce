// A restricted staff user sees only Projects, Tasks, Photos+Documents,
// Notifications and their own Profile in the sidebar.

import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/shared/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/api')>('@/shared/lib/api');
  return { ...actual, ...api };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: unknown }) =>
      typeof opts?.defaultValue === 'string' ? opts.defaultValue : key,
    i18n: { language: 'fa', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/shared/lib/useI18nReady', () => ({ useI18nReady: () => 0 }));
vi.mock('./CustomBranding', () => ({ CustomBranding: () => null }));
vi.mock('@/shared/ui/UpdateChecker', () => ({ UpdateNotification: () => null, UpdateBadge: () => null }));
vi.mock('@/features/modules/RequestCustomModuleDialog', () => ({
  RequestCustomModuleDialog: () => null,
}));
vi.mock('@/shared/hooks/useSidebarBadges', () => ({
  useSidebarBadges: () => ({ tasks: 0, rfi: 0, safety: 0 }),
}));
vi.mock('@/shared/hooks/useHiddenModules', () => ({
  useHiddenModules: () => ({ hiddenModules: [], setHiddenModules: vi.fn() }),
}));
vi.mock('@/features/projects/useProjectProfile', () => ({
  useActiveProjectProfile: () => ({ projectId: null, profile: undefined, isLoading: false }),
  buildModuleGate: () => ({ active: false, byRoute: () => null }),
}));

import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/stores/useAuthStore';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({ restrictedMode: false });
});

describe('Sidebar for restricted staff', () => {
  it('offers only the five allowed destinations', () => {
    api.apiGet.mockResolvedValue([]);
    useAuthStore.setState({ isAuthenticated: true, restrictedMode: true, userRole: 'viewer' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const hrefs = Array.from(container.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') as string)
      .filter((h) => h.startsWith('/'));
    for (const want of ['/projects', '/tasks', '/files', '/notifications', '/profile']) {
      expect(hrefs).toContain(want);
    }
    for (const banned of ['/settings', '/about', '/boq', '/costs', '/finance', '/ai-estimate']) {
      expect(hrefs).not.toContain(banned);
    }
    // Module list is an admin-shell call; restricted users must not make it.
    expect(api.apiGet).not.toHaveBeenCalledWith('/v1/modules/');
  });
});
