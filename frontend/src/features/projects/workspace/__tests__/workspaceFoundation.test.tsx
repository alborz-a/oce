import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Project } from '@/features/projects/api';
import { computeProjectWorkspaceStats } from '../hooks/useProjectWorkspaceStats';
import { ProjectGroupSwitcherSidebar } from '../components/ProjectGroupSwitcherSidebar';
import { ProjectRightSummaryPanel } from '../components/ProjectRightSummaryPanel';
import { MizitoTopTabAndFilterBar } from '../components/MizitoTopTabAndFilterBar';
import { DEFAULT_STREAM_FILTERS, type ProjectTaskItem, type WorkspaceMember } from '../types';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/shared/ui/UserSearchInput', () => ({
  UserSearchInput: () => <input data-testid="mock-user-search" />,
}));

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: overrides.id ?? 'p-1',
    name: overrides.name ?? 'پروژه بسیج ۱۸',
    description: '',
    region: 'IR',
    classification_standard: 'din276',
    currency: 'IRR',
    locale: 'fa',
    validation_rule_sets: [],
    status: overrides.status ?? 'active',
    owner_id: 'owner-1',
    metadata: overrides.metadata ?? {},
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Project Workspace Foundation Components', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('ProjectGroupSwitcherSidebar renders the Mizito nav items and همکارانم', () => {
    const projects: Project[] = [
      makeProject({ id: 'p-edari', name: 'پیگیری اداری' }),
      makeProject({ id: 'p-basij', name: 'بسیج 18' }),
      makeProject({ id: 'p-arch', name: 'بایگانی قدیم', status: 'archived' }),
    ];

    const members: WorkspaceMember[] = [
      {
        user_id: 'u-1',
        email: 'maryam@royalstars.co',
        full_name: 'محبوبه کرامت',
        role: 'member',
        is_owner: false,
      },
      {
        user_id: 'u-imp',
        email: 'mizito-importer@royalstars.co',
        full_name: 'Mizito Importer',
        role: 'owner',
        is_owner: true,
      },
    ];

    const tasks: ProjectTaskItem[] = [
      {
        id: 't-1',
        project_id: 'p-edari',
        title: 'دریافت گواهی عدم خلاف',
        status: 'in_progress',
        responsible_id: 'u-1',
        created_at: '2026-11-10T00:00:00Z',
      },
    ];

    const onSelectProject = vi.fn();

    renderWithQuery(
      <ProjectGroupSwitcherSidebar
        projects={projects}
        activeProjectId="p-edari"
        onSelectProject={onSelectProject}
        currentUserId="u-other"
        members={members}
        tasks={tasks}
      />,
    );

    // Mizito nav replaces the project search and groups; پروژه‌ها item routes to /projects
    expect(screen.getByTestId('mizito-nav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'داشبورد' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'گفتگو' })).toHaveAttribute('href', '/chat');
    expect(screen.getByRole('link', { name: 'پروژه‌ها' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'وظایف' })).toHaveAttribute('href', '/tasks');
    expect(screen.getByRole('link', { name: 'نامه‌ها' })).toHaveAttribute('href', '/correspondence');
    expect(screen.queryByTestId('switcher-search-input')).not.toBeInTheDocument();

    // Hidden Mizito Importer is stripped for non-admin; colleague task subtitle appears
    expect(screen.queryByText('Mizito Importer')).not.toBeInTheDocument();
    expect(screen.getByText('محبوبه کرامت')).toBeInTheDocument();
    expect(screen.getByText('دریافت گواهی عدم خلاف')).toBeInTheDocument();
  });

  it('ProjectRightSummaryPanel renders all-done green double check when remainingCount === 0 and board click switches to board tab', () => {
    const project = makeProject({ id: 'p-golshani', name: 'امیرکبیر - گلشنی' });
    const members: WorkspaceMember[] = [
      { user_id: 'u-1', email: 'a@rs.co', full_name: 'کاربر تست', role: 'member', is_owner: false },
    ];

    const allDoneTasks: ProjectTaskItem[] = [
      {
        id: 't1',
        project_id: 'p-golshani',
        title: 'تکمیل سقف',
        status: 'completed',
        responsible_id: 'u-1',
        metadata: { mizito_board: 'سرداران 2' },
        created_at: '2026-11-01T00:00:00Z',
      },
    ];
    const doneStats = computeProjectWorkspaceStats(allDoneTasks, 'u-1', {
      todayIso: '2026-11-16',
    });

    const onBoardClick = vi.fn();
    const onStartOnlineMeeting = vi.fn();

    renderWithQuery(
      <ProjectRightSummaryPanel
        project={project}
        stats={doneStats}
        members={members}
        currentUserId="u-1"
        onBoardClick={onBoardClick}
        onStartOnlineMeeting={onStartOnlineMeeting}
      />,
    );

    expect(screen.getByTestId('summary-all-done-check')).toBeInTheDocument();
    expect(screen.getByText('وضعیت کلی پروژه: «تعداد کار باقیمانده: ۰»')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('online-meeting-button'));
    expect(onStartOnlineMeeting).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('summary-board-row-سرداران 2'));
    expect(onBoardClick).toHaveBeenCalledWith('سرداران 2');
  });

  it('ProjectRightSummaryPanel shows a letters entry next to the online-meeting button and calls onOpenLetters', () => {
    const project = makeProject({ id: 'p-letters', name: 'پروژه نامه' });
    const stats = computeProjectWorkspaceStats([], 'u-1', { todayIso: '2026-11-16' });
    const onOpenLetters = vi.fn();

    renderWithQuery(
      <ProjectRightSummaryPanel
        project={project}
        stats={stats}
        members={[]}
        currentUserId="u-1"
        onStartOnlineMeeting={vi.fn()}
        onOpenLetters={onOpenLetters}
      />,
    );

    const lettersBtn = screen.getByTestId('letters-inbox-button');
    expect(lettersBtn).toHaveTextContent('نامه‌ها');
    expect(lettersBtn.parentElement).toBe(screen.getByTestId('online-meeting-button').parentElement);
    fireEvent.click(lettersBtn);
    expect(onOpenLetters).toHaveBeenCalledTimes(1);
  });

  it('MizitoTopTabAndFilterBar renders 5 tabs, stream filters only on group tab, and admin switch', () => {
    const onTabChange = vi.fn();
    const onFiltersChange = vi.fn();
    const onSwitchToEngineering = vi.fn();

    const { rerender } = render(
      <MizitoTopTabAndFilterBar
        activeTab="group"
        onTabChange={onTabChange}
        filters={DEFAULT_STREAM_FILTERS}
        onFiltersChange={onFiltersChange}
        canSwitchToEngineering
        onSwitchToEngineering={onSwitchToEngineering}
      />,
    );

    expect(screen.getByTestId('workspace-tab-group')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stream-filter-search')).toBeInTheDocument();
    expect(screen.getByTestId('switch-to-engineering-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stream-filter-kind-photos'));
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_STREAM_FILTERS,
      kind: 'photos',
    });

    fireEvent.click(screen.getByTestId('workspace-tab-board'));
    expect(onTabChange).toHaveBeenCalledWith('board');

    fireEvent.click(screen.getByTestId('switch-to-engineering-view'));
    expect(onSwitchToEngineering).toHaveBeenCalledTimes(1);

    rerender(
      <MizitoTopTabAndFilterBar
        activeTab="tasks"
        onTabChange={onTabChange}
        filters={DEFAULT_STREAM_FILTERS}
        onFiltersChange={onFiltersChange}
        canSwitchToEngineering={false}
      />,
    );
    expect(screen.queryByTestId('stream-filter-search')).not.toBeInTheDocument();
    expect(screen.queryByTestId('switch-to-engineering-view')).not.toBeInTheDocument();
  });
});
