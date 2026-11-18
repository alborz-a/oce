import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MonitoringModule } from './MonitoringModule';
import { apiGet } from '@/shared/lib/api';
import { fetchAllTasks } from '@/features/tasks/api';
import { useGlobalPresenceStore } from '@/stores/useGlobalPresenceStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

vi.mock('@/modules/_shared/MizitoPageShell', () => ({
  MizitoPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
}));

vi.mock('@/features/tasks/api', () => ({
  fetchAllTasks: vi.fn(),
}));

vi.mock('@/shared/lib/hiddenUsers', () => ({
  useVisibleMembers: (members: unknown[]) => members,
}));

const members = [
  { user_id: 'u1', full_name: 'علی', email: 'ali@example.com' },
  { user_id: 'u2', full_name: 'رضا', email: 'reza@example.com' },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MonitoringModule />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MonitoringModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectContextStore.setState({ activeProjectId: 'p1' } as never);
    useGlobalPresenceStore.setState({
      users: {
        u1: { user_id: 'u1', user_name: 'علی', route: '/projects/p1', status: 'active', last_active: new Date().toISOString() },
      },
    } as never);
    vi.mocked(apiGet).mockResolvedValue(members);
    vi.mocked(fetchAllTasks).mockResolvedValue([
      { responsible_id: 'u2', title: 'بازرسی', status: 'in_progress' },
    ] as never);
  });

  it('shows online and offline counts and a row per colleague', async () => {
    renderPage();
    expect(await screen.findByTestId('monitoring-table')).toBeInTheDocument();
    expect(screen.getByTestId('monitoring-online-count')).toHaveTextContent('آنلاین ۱');
    expect(screen.getByTestId('monitoring-offline-count')).toHaveTextContent('آفلاین ۱');
    expect(screen.getByTestId('monitoring-dot-u1')).toHaveAttribute('data-online', 'true');
    expect(screen.getByTestId('monitoring-dot-u2')).toHaveAttribute('data-online', 'false');
    expect(screen.getByTestId('monitoring-row-u2')).toHaveTextContent('بازرسی');
  });

  it('asks the user to pick a project when none is active', async () => {
    useProjectContextStore.setState({ activeProjectId: null } as never);
    renderPage();
    expect(await screen.findByTestId('monitoring-no-project')).toHaveTextContent('پروژه‌ای انتخاب نشده است');
    expect(screen.queryByTestId('monitoring-table')).toBeNull();
  });
});
