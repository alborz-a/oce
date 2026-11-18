import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NotesModule } from './NotesModule';
import { notesApi, type UserNote } from './api';

vi.mock('@/modules/_shared/MizitoPageShell', () => ({
  MizitoPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./api', () => ({
  NOTE_COLORS: ['#fb0', '#1f5c88'],
  notesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const note = (id: string, title: string, pinned = false): UserNote => ({
  id,
  title,
  body: `متن ${title}`,
  color: '#fb0',
  pinned,
  created_at: '2026-11-18T00:00:00Z',
  updated_at: '2026-11-18T00:00:00Z',
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotesModule />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotesModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when the user has no notes', async () => {
    vi.mocked(notesApi.list).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId('notes-empty')).toHaveTextContent('یادداشتی ندارید');
  });

  it('renders one card per note returned by the api, in server order', async () => {
    vi.mocked(notesApi.list).mockResolvedValue([note('n1', 'سنجاق', true), note('n2', 'معمولی')]);
    renderPage();
    expect(await screen.findByTestId('note-card-n1')).toHaveTextContent('سنجاق');
    expect(screen.getByTestId('note-card-n2')).toHaveTextContent('معمولی');
    expect(screen.queryByTestId('notes-empty')).toBeNull();
  });

  it('creates a note from the editor dialog', async () => {
    vi.mocked(notesApi.list).mockResolvedValue([]);
    vi.mocked(notesApi.create).mockResolvedValue(note('n3', 'جدید'));
    renderPage();
    await screen.findByTestId('notes-empty');

    fireEvent.click(screen.getByTestId('notes-create'));
    fireEvent.change(screen.getByTestId('note-title-input'), { target: { value: 'جدید' } });
    fireEvent.click(screen.getByTestId('note-save'));

    await waitFor(() =>
      expect(notesApi.create).toHaveBeenCalledWith({ title: 'جدید', body: '', color: '#fb0' }),
    );
  });
});
