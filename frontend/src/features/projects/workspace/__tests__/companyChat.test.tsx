import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MizitoNav } from '../components/MizitoNav';
import { CompanyChatPanel } from '../components/CompanyChatPanel';

const apiGetMock = vi.fn();

vi.mock('@/shared/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock('../components/ProjectGroupTab', () => ({
  ProjectGroupTab: (props: { dm?: { room: { id: string }; peerName: string } | null }) => (
    <div data-testid="company-chat-shell">
      {props.dm ? `${props.dm.peerName}:${props.dm.room.id}` : 'no-room'}
    </div>
  ),
}));

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('company chat in Mizito shell', () => {
  it('nav گفتگو item opens company chat instead of navigating to /chat', () => {
    const onOpen = vi.fn();
    render(wrap(<MizitoNav onOpenCompanyChat={onOpen} />));
    fireEvent.click(screen.getByTestId('mizito-nav-company-chat'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('panel loads the company room from the room list and feeds it to the chat shell', async () => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue([
      { id: 'p-1', kind: 'project', name: 'x' },
      { id: 'c-1', kind: 'company', name: 'شرکت' },
    ]);
    render(
      wrap(
        <CompanyChatPanel
          projectId="proj-1"
          currentUserId="u-1"
          members={[]}
          onClose={() => {}}
        />,
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('company-chat-shell')).toHaveTextContent('شرکت:c-1'),
    );
    expect(apiGetMock).toHaveBeenCalledWith('/v1/team-chat/rooms/');
  });

  it('panel shows an error when no company room is returned', async () => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue([{ id: 'p-1', kind: 'project', name: 'x' }]);
    render(
      wrap(
        <CompanyChatPanel projectId="proj-1" currentUserId="u-1" members={[]} onClose={() => {}} />,
      ),
    );
    await waitFor(() => expect(screen.getByTestId('company-chat-error')).toBeInTheDocument());
  });
});
