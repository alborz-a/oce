import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiGetMock = vi.fn();
vi.mock('@/shared/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
}));

vi.mock('@/features/projects/api', () => ({
  projectsApi: { list: vi.fn().mockResolvedValue([{ id: 'p1', name: 'پروژه' }]) },
}));

vi.mock('@/shared/ui/UserAvatar', () => ({
  UserAvatar: ({ url, alt }: { url: string | null | undefined; alt: string }) => (
    <img data-testid="colleague-avatar" src={url ?? ''} alt={alt} />
  ),
}));

const openDmMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../hooks/useOpenColleagueDm', () => ({
  useOpenColleagueDm: () => openDmMock,
}));

vi.mock('../hooks/useSwitcherState', () => ({
  useSwitcherState: () => ({ open: false, setOpen: vi.fn(), desktopHidden: false, onMenuClick: vi.fn() }),
}));

vi.mock('../mizitoSwitcherBridge', () => ({
  registerMizitoSwitcher: () => () => {},
}));

vi.mock('../components/ProjectGroupSwitcherSidebar', () => ({
  ProjectGroupSwitcherSidebar: () => null,
  usePinnedProjects: () => ({ pinnedIds: [], togglePin: vi.fn() }),
}));

import { MizitoColleaguesPage } from '../components/MizitoColleaguesPage';

const COLLEAGUES = [
  { id: 'c1', full_name: 'آلیس', job_title: 'مدیر پروژه', avatar_url: '/api/v1/users/c1/avatar?v=1' },
  { id: 'c2', full_name: 'باب', job_title: null, avatar_url: null },
  { id: 'c3', full_name: 'کارول', job_title: 'Site Engineer', avatar_url: null },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<MizitoColleaguesPage />, { wrapper: wrap });
}

describe('MizitoColleaguesPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(COLLEAGUES);
    openDmMock.mockClear();
  });

  it('renders avatar, full name and job title per row, and omits the title line when null', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('colleague-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('آلیس')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('مدیر پروژه')).toBeInTheDocument();
    expect(within(rows[0]!).getByTestId('colleague-avatar')).toHaveAttribute('src', '/api/v1/users/c1/avatar?v=1');
    expect(within(rows[1]!).queryByTestId('colleague-job-title')).toBeNull();
    expect(apiGetMock).toHaveBeenCalledWith('/v1/team-chat/colleagues/');
  });

  it('filters by name and job title, case-insensitive', async () => {
    renderPage();
    await screen.findByText('آلیس');
    const search = screen.getByTestId('colleagues-search');
    fireEvent.change(search, { target: { value: 'site' } });
    expect(screen.getAllByTestId('colleague-row')).toHaveLength(1);
    expect(screen.getByText('کارول')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'nomatchqq' } });
    expect(screen.getByTestId('colleagues-empty')).toHaveTextContent('همکاری پیدا نشد.');
  });

  it('click on a colleague opens the DM with that colleague id', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('colleague-row');
    fireEvent.click(rows[1]!);
    await waitFor(() => expect(openDmMock).toHaveBeenCalledWith('c2'));
  });

  it('shows the Farsi error state when the colleague fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByTestId('colleagues-error')).toHaveTextContent('خطا در بارگذاری همکاران.');
  });
});
