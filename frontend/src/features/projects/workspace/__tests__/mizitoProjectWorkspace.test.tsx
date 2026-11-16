import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const adminFlag = { value: false };

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));
vi.mock('@/features/tasks/api', () => ({
  fetchTasks: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
  fetchAllTasks: vi.fn().mockResolvedValue([]),
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
  useIsSystemAdmin: () => adminFlag.value,
  isSystemAdminRole: (r: string | null | undefined) => r === 'admin',
}));
vi.mock('../components/ProjectGroupTab', () => ({ ProjectGroupTab: () => <div /> }));
vi.mock('../components/ProjectGroupSwitcherSidebar', () => ({
  ProjectGroupSwitcherSidebar: () => <aside />,
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

describe('MizitoProjectWorkspace mount', () => {
  beforeEach(() => {
    window.localStorage.clear();
    adminFlag.value = false;
  });

  it('renders the 5 Mizito tab labels inside .mizito-workspace-light', () => {
    const { container } = renderPage();
    expect(container.querySelector('.mizito-workspace-light')).not.toBeNull();
    for (const label of ['گروه پروژه', 'وظایف پروژه', 'بورد پروژه', 'تقویم پروژه', 'گانت پروژه']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('hides the OCE engineering toggle for non-admin', () => {
    renderPage();
    expect(screen.queryByText('نمای مهندسی OCE')).not.toBeInTheDocument();
  });

  it('shows the OCE engineering toggle for admin', () => {
    adminFlag.value = true;
    renderPage();
    expect(screen.getByText('نمای مهندسی OCE')).toBeInTheDocument();
  });
});
