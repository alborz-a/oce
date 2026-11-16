import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { isSyntheticAlbumTask } from '../syntheticAlbumTask';

const ZWNJ = '‌';
const ALBUM_ZWNJ = `تعیین موضوع عکس${ZWNJ}ها — 1405/07/15`;
const ALBUM_SPACE = 'تعیین موضوع عکس ها — 1405/07/15';
const REAL_TASK = 'تعیین موضوع جلسه';

const captured = vi.hoisted(() => ({ sidebarTasks: [] as Array<{ title: string }> }));
const fetchAllTasksMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));
vi.mock('@/features/tasks/api', () => ({
  fetchTasks: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
  fetchAllTasks: fetchAllTasksMock,
}));
vi.mock('@/features/projects/api', () => ({
  projectsApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({
      id: 'p-1',
      name: 'بسیج 18',
      status: 'active',
      metadata: {},
      currency: 'IRR',
    }),
  },
}));
vi.mock('@/shared/lib/systemAdmin', () => ({
  useIsSystemAdmin: () => false,
  isSystemAdminRole: (r: string | null | undefined) => r === 'admin',
}));
vi.mock('../components/ProjectGroupTab', () => ({ ProjectGroupTab: () => <div /> }));
vi.mock('../components/ProjectGroupSwitcherSidebar', () => ({
  ProjectGroupSwitcherSidebar: (props: { tasks: Array<{ title: string }> }) => {
    captured.sidebarTasks = props.tasks;
    return <aside />;
  },
  usePinnedProjects: () => ({ pinnedIds: [], togglePin: () => {} }),
}));
vi.mock('../components/ProjectRightSummaryPanel', () => ({
  ProjectRightSummaryPanel: () => <aside />,
}));
import { ProjectDetailPage } from '../../ProjectDetailPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/projects/p-1']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('isSyntheticAlbumTask', () => {
  it('matches the ZWNJ spelling with a date suffix', () => {
    expect(isSyntheticAlbumTask({ title: ALBUM_ZWNJ })).toBe(true);
  });

  it('matches the plain-space spelling with a date suffix', () => {
    expect(isSyntheticAlbumTask({ title: ALBUM_SPACE })).toBe(true);
  });

  it('matches with surrounding whitespace', () => {
    expect(isSyntheticAlbumTask({ title: `  ${ALBUM_SPACE}  ` })).toBe(true);
  });

  it('does not match a real task starting with تعیین موضوع', () => {
    expect(isSyntheticAlbumTask({ title: REAL_TASK })).toBe(false);
  });

  it('does not match an empty title', () => {
    expect(isSyntheticAlbumTask({ title: '' })).toBe(false);
  });
});

describe('MizitoProjectWorkspace synthetic album filter', () => {
  beforeEach(() => {
    window.localStorage.clear();
    captured.sidebarTasks = [];
    fetchAllTasksMock.mockResolvedValue([
      { id: 't-1', project_id: 'p-1', title: ALBUM_ZWNJ, status: 'open', task_type: 'task' },
      { id: 't-2', project_id: 'p-1', title: ALBUM_SPACE, status: 'open', task_type: 'task' },
      { id: 't-3', project_id: 'p-1', title: REAL_TASK, status: 'open', task_type: 'task' },
    ]);
  });

  it('passes only non-album tasks to the workspace children', async () => {
    renderPage();
    await vi.waitFor(() => expect(captured.sidebarTasks.length).toBeGreaterThan(0));
    expect(captured.sidebarTasks.map((t) => t.title)).toEqual([REAL_TASK]);
  });
});
