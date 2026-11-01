// Restricted staff land on the simple Farsi dashboard, and the wizard route
// guard turns them away.

import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ apiGet: vi.fn() }));

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

import { DashboardPage } from '../DashboardPage';
import { AdminOnly } from '@/shared/auth/AdminOnly';
import { useAuthStore } from '@/stores/useAuthStore';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({ restrictedMode: false, userRole: 'viewer' });
});

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('restricted landing', () => {
  it('DashboardPage renders RestrictedDashboard and only calls allowed endpoints', async () => {
    api.apiGet.mockResolvedValue([]);
    useAuthStore.setState({ restrictedMode: true, userRole: 'viewer', userFullName: 'تست' });
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/سامانه کنترل پروژه رویال استارز/)).toBeTruthy();
    await vi.waitFor(() => expect(api.apiGet).toHaveBeenCalled());
    for (const call of api.apiGet.mock.calls) {
      expect(String(call[0])).toMatch(/^\/v1\/(projects|tasks|documents\/photos)\//);
    }
  });

  it('wizard route guard redirects a non-admin (restricted) user', () => {
    useAuthStore.setState({ restrictedMode: true, userRole: 'viewer' });
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route
            path="/onboarding"
            element={
              <AdminOnly redirectTo="/dashboard">
                <p>wizard</p>
              </AdminOnly>
            }
          />
          <Route path="/dashboard" element={<p>landing</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('wizard')).toBeNull();
    expect(screen.getByText('landing')).toBeTruthy();
  });
});
