import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { apiGet } from '@/shared/lib/api';
import { MizitoNav } from '../components/MizitoNav';
import { useMyTaskCounts } from '../hooks/useMyTaskCounts';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
}));

function Harness() {
  const counts = useMyTaskCounts();
  return (
    <MemoryRouter>
      <MizitoNav counts={{ taskOverdue: counts.overdue, taskOpen: counts.open }} />
    </MemoryRouter>
  );
}

function renderHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('useMyTaskCounts nav pills', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
  });

  it('fetches /v1/tasks/my-counts/ and shows both pills', async () => {
    vi.mocked(apiGet).mockResolvedValue({ overdue: 5, open: 2 });
    renderHarness();
    expect(await screen.findByTestId('mz-nav-badge-task-overdue')).toHaveTextContent('۵');
    expect(screen.getByTestId('mz-nav-badge-task-open')).toHaveTextContent('۲');
    expect(apiGet).toHaveBeenCalledWith('/v1/tasks/my-counts/');
  });

  it('shows no pills silently when the request fails', async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error('500'));
    renderHarness();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('mz-nav-badge-task-overdue')).toBeNull();
    expect(screen.queryByTestId('mz-nav-badge-task-open')).toBeNull();
  });
});
