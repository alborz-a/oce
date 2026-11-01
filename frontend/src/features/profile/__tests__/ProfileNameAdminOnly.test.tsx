import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

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

import { ProfilePage } from '../ProfilePage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('profile full name', () => {
  it('shows the name input to admin', async () => {
    api.apiGet.mockResolvedValue({ id: '1', email: 'a@b.co', full_name: 'Admin', role: 'admin' });
    renderPage();
    expect(await screen.findByPlaceholderText('نام کامل خود را وارد کنید')).toBeTruthy();
  });
  it('hides the name input from staff', async () => {
    api.apiGet.mockResolvedValue({ id: '2', email: 'p@b.co', full_name: 'Staff', role: 'editor' });
    renderPage();
    await screen.findAllByText('Staff');
    expect(screen.queryByPlaceholderText('نام کامل خود را وارد کنید')).toBeNull();
  });
});
