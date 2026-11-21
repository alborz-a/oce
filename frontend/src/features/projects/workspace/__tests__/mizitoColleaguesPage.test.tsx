import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';

const apiGetMock = vi.fn();
vi.mock('@/shared/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
}));

vi.mock('@/features/projects/api', () => ({
  projectsApi: { list: vi.fn().mockResolvedValue([{ id: 'p1', name: 'پروژه' }]) },
}));

vi.mock('@/shared/ui/UserAvatar', () => ({
  UserAvatar: ({
    url,
    alt,
    fallback,
  }: {
    url: string | null | undefined;
    alt: string;
    fallback?: ReactNode;
  }) => (url ? <img data-testid="user-avatar-img" src={url} alt={alt} /> : <>{fallback ?? null}</>),
}));

const openDmMock = vi.fn();
vi.mock('../hooks/useOpenColleagueDm', () => ({
  useOpenColleagueDm:
    (uid: string, onOpenRoom?: (room: unknown, otherUserId: string) => void) => (otherUserId: string) => {
      openDmMock(otherUserId);
      onOpenRoom?.({ id: 'room9', kind: 'dm', name: '', unread: 0, member_ids: [uid, otherUserId] }, otherUserId);
      return Promise.resolve();
    },
}));

// The real ProjectGroupTab pulls in the whole chat stack; here only its props and DM header are checked.
let lastGroupTabProps: {
  projectId: string;
  dm?: { peerName: string } | null;
  dmBackLabel?: string;
} | null = null;
vi.mock('../components/ProjectGroupTab', () => ({
  ProjectGroupTab: (props: { projectId: string; dm?: { peerName: string } | null; dmBackLabel?: string }) => {
    lastGroupTabProps = props;
    return props.dm ? (
      <div data-testid="workspace-dm-header">
        {props.dm.peerName}
        <button type="button" data-testid="workspace-dm-back" aria-label={props.dmBackLabel} />
      </div>
    ) : null;
  },
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

const ROOMS = [{ id: 'room9', kind: 'dm', name: '', unread: 0, member_ids: ['me', 'c2'] }];

let lastPath = '';
function LocationProbe() {
  lastPath = useLocation().pathname;
  return null;
}

function renderPage(path = '/colleagues') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/colleagues" element={<MizitoColleaguesPage />} />
          <Route path="/colleagues/:roomId" element={<MizitoColleaguesPage />} />
          <Route path="/projects/:projectId" element={<div>project</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MizitoColleaguesPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ userId: 'me' } as never);
    apiGetMock.mockReset();
    apiGetMock.mockImplementation((path: string) =>
      Promise.resolve(path.startsWith('/v1/team-chat/rooms/') ? ROOMS : COLLEAGUES),
    );
    openDmMock.mockClear();
    lastGroupTabProps = null;
    lastPath = '';
  });

  it('renders avatar, full name and job title per row, and omits the title line when null', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('colleague-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('آلیس')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('مدیر پروژه')).toBeInTheDocument();
    expect(within(rows[0]!).getByTestId('user-avatar-img')).toHaveAttribute('src', '/api/v1/users/c1/avatar?v=1');
    expect(within(rows[1]!).queryByTestId('colleague-job-title')).toBeNull();
    expect(apiGetMock).toHaveBeenCalledWith('/v1/team-chat/colleagues/');
  });

  it('wraps every avatar in a fixed 40px round container', async () => {
    renderPage();
    const wrappers = await screen.findAllByTestId('colleague-avatar');
    expect(wrappers).toHaveLength(3);
    for (const w of wrappers) {
      expect(w).toHaveClass('h-[40px]', 'w-[40px]', 'shrink-0', 'overflow-hidden', 'rounded-full');
    }
  });

  it('shows initials in a 40px circle when avatar_url is null', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('colleague-row');
    expect(within(rows[1]!).getByTestId('colleague-avatar-initials')).toHaveTextContent('با');
    expect(within(rows[1]!).queryByTestId('user-avatar-img')).toBeNull();
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

  it('click on a colleague opens the DM and navigates to /colleagues/<room id>, never to a project', async () => {
    renderPage();
    const rows = await screen.findAllByTestId('colleague-row');
    fireEvent.click(rows[1]!);
    await waitFor(() => expect(lastPath).toBe('/colleagues/room9'));
    expect(openDmMock).toHaveBeenCalledWith('c2');
    expect(lastPath.startsWith('/projects')).toBe(false);
  });

  it('DM route shows the DM header with the peer name and no project id', async () => {
    renderPage('/colleagues/room9');
    expect(await screen.findByTestId('workspace-dm-header')).toHaveTextContent('باب');
    expect(lastGroupTabProps?.projectId).toBe('');
    expect(lastGroupTabProps?.dm?.peerName).toBe('باب');
    expect(screen.queryByTestId('colleagues-search')).toBeNull();
  });

  it('DM back button is labelled as back to colleagues', async () => {
    renderPage('/colleagues/room9');
    expect(await screen.findByTestId('workspace-dm-back')).toHaveAttribute('aria-label', 'بازگشت به همکارانم');
    expect(lastGroupTabProps?.dmBackLabel).toBe('بازگشت به همکارانم');
  });

  it('shows the Farsi error state when the colleague fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByTestId('colleagues-error')).toHaveTextContent('خطا در بارگذاری همکاران.');
  });
});
