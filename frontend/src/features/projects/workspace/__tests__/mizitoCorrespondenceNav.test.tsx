import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MizitoNav } from '../components/MizitoNav';
import { MizitoCorrespondencePage } from '../components/MizitoCorrespondencePage';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

vi.mock('@/features/correspondence/CorrespondencePage', () => ({
  CorrespondencePage: () => <div data-testid="correspondence-body" />,
}));

vi.mock('@/features/projects/api', () => ({
  projectsApi: { list: vi.fn(async () => []) },
}));

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(async () => []),
}));

function renderLettersPage(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/correspondence" element={<MizitoCorrespondencePage />} />
          <Route path="/projects/:projectId/correspondence" element={<MizitoCorrespondencePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('نامه‌ها nav item target', () => {
  it('links the right-panel «نامه‌ها» item to the active project letters route', () => {
    useProjectContextStore.getState().setActiveProject('p1', 'Project 1');
    render(
      <MemoryRouter>
        <MizitoNav />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'نامه‌ها' });
    expect(link).toHaveAttribute('href', '/projects/p1/correspondence');
    useProjectContextStore.getState().clearProject();
  });

  it('prefers the current route project over a stale store project', () => {
    useProjectContextStore.getState().setActiveProject('stale-store', 'Stale');
    render(
      <MemoryRouter initialEntries={['/projects/route-p9/settings']}>
        <Routes>
          <Route path="/projects/:projectId/*" element={<MizitoNav />} />
        </Routes>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'نامه‌ها' });
    expect(link).toHaveAttribute('href', '/projects/route-p9/correspondence');
    useProjectContextStore.getState().clearProject();
  });

  it('falls back to /correspondence when no project is active', () => {
    useProjectContextStore.getState().clearProject();
    render(
      <MemoryRouter>
        <MizitoNav />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'نامه‌ها' });
    expect(link).toHaveAttribute('href', '/correspondence');
  });

  it('renders the correspondence module inside the Mizito shell and restores chrome on unmount', () => {
    useWorkspaceChromeStore.getState().setActive(false);
    const { unmount } = renderLettersPage('/correspondence');
    expect(screen.getByTestId('correspondence-body')).toBeInTheDocument();
    expect(useWorkspaceChromeStore.getState().active).toBe(true);
    unmount();
    expect(useWorkspaceChromeStore.getState().active).toBe(false);
  });

  it('shows the right-panel MizitoNav on the letters page with نامه‌ها highlighted', () => {
    renderLettersPage('/correspondence');
    const nav = screen.getByTestId('mizito-nav');
    expect(within(nav).getByRole('link', { name: 'داشبورد' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'پروژه‌ها' })).toHaveAttribute('href', '/projects');
    expect(within(nav).getByRole('link', { name: 'وظایف' })).toHaveAttribute('href', '/tasks');
    expect(within(nav).getByRole('link', { name: 'گفتگو' })).toHaveAttribute('href', '/chat');
    expect(within(nav).getByRole('link', { name: 'نامه‌ها' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'پروژه‌ها' })).not.toHaveAttribute('aria-current');
  });

  it('shows the nav on the project-scoped letters route too', () => {
    renderLettersPage('/projects/p1/correspondence');
    const nav = screen.getByTestId('mizito-nav');
    expect(within(nav).getByRole('link', { name: 'نامه‌ها' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'پروژه‌ها' })).not.toHaveAttribute('aria-current');
  });
});
