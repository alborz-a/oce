import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const TASK = {
  id: 't-1',
  project_id: 'p-1',
  title: 'وظیفه نمونه',
  status: 'todo',
};

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));
vi.mock('@/features/tasks/api', () => ({
  fetchTasks: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
  fetchAllTasks: vi.fn().mockResolvedValue([
    {
      id: 't-1',
      project_id: 'p-1',
      title: 'وظیفه نمونه',
      status: 'todo',
    },
  ]),
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
  ProjectGroupSwitcherSidebar: () => <aside />,
  usePinnedProjects: () => ({ pinnedIds: [], togglePin: () => {} }),
}));
vi.mock('../components/ProjectRightSummaryPanel', () => ({
  ProjectRightSummaryPanel: () => <aside />,
}));
// Stub the tasks tab: one button per task that calls the onSelectTask prop wired by the workspace.
vi.mock('../components/ProjectTasksTab', () => ({
  ProjectTasksTab: ({
    tasks,
    onSelectTask,
  }: {
    tasks: { id: string; title: string }[];
    onSelectTask?: (task: { id: string; title: string }) => void;
  }) => (
    <ul>
      {tasks.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => onSelectTask?.(t)}>
            {t.title}
          </button>
        </li>
      ))}
    </ul>
  ),
}));
// Stub the dialog: renders only when the workspace opens it with a task.
vi.mock('../components/TaskQuickDetailDialog', () => ({
  TaskQuickDetailDialog: ({
    task,
    open,
  }: {
    task: { title: string } | null;
    open: boolean;
  }) => (open && task ? <div role="dialog">{`detail:${task.title}`}</div> : null),
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

describe('MizitoProjectWorkspace task quick detail wiring', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('opens the task quick detail dialog when a task is clicked in the tasks tab', async () => {
    renderPage();
    fireEvent.click(screen.getByText('وظایف پروژه'));
    const taskButton = await screen.findByRole('button', { name: TASK.title });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(taskButton);
    expect(await screen.findByRole('dialog')).toHaveTextContent(`detail:${TASK.title}`);
  });
});
