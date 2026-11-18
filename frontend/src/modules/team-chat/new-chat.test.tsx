import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { apiGet, apiPost } from '@/shared/lib/api';
import { JobTitleBadge } from '@/shared/ui/JobTitleBadge';
import { NewChatDialog } from './NewChatDialog';
import { RoomList } from './RoomList';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  downloadWithAuth: vi.fn(() => Promise.resolve()),
}));

const COLLEAGUES = [
  { id: 'u2', full_name: 'علی رضایی', job_title: 'مدیر فروش' },
  { id: 'u3', full_name: 'سارا احمدی', job_title: null },
];

beforeEach(() => {
  vi.mocked(apiGet).mockImplementation(async (path: string) => {
    if (path.includes('colleagues')) return COLLEAGUES;
    return [];
  });
  vi.mocked(apiPost).mockImplementation(async (_path: string, body: unknown) => ({ id: 'room-new', ...(body as object) }));
});

describe('NewChatDialog', () => {
  it('dm: clicking a colleague posts a dm room with [me, other]', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<NewChatDialog mode="dm" me={{ id: 'me' }} onClose={onClose} onCreated={onCreated} />);
    const row = await waitFor(() => screen.getAllByTestId('colleague-row')[0]!);
    fireEvent.click(row);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/team-chat/rooms/', { kind: 'dm', member_ids: ['me', 'u2'] }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('group: submit stays disabled until a name is typed, then posts kind group with selected ids', async () => {
    render(<NewChatDialog mode="group" me={{ id: 'me' }} onClose={vi.fn()} onCreated={vi.fn()} />);
    const submit = screen.getByTestId('new-chat-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const rows = await waitFor(() => screen.getAllByTestId('colleague-row'));
    fireEvent.click(within(rows[0]!).getByRole('checkbox'));
    fireEvent.change(screen.getByTestId('new-chat-name'), { target: { value: '  تیم فروش ' } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/team-chat/rooms/', {
        kind: 'group',
        name: 'تیم فروش',
        member_ids: ['me', 'u2'],
      }),
    );
  });

  it('channel: posts kind channel', async () => {
    render(<NewChatDialog mode="channel" me={{ id: 'me' }} onClose={vi.fn()} onCreated={vi.fn()} />);
    await waitFor(() => screen.getAllByTestId('colleague-row'));
    fireEvent.change(screen.getByTestId('new-chat-name'), { target: { value: 'اعلانات' } });
    fireEvent.click(screen.getByTestId('new-chat-submit'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/v1/team-chat/rooms/', { kind: 'channel', name: 'اعلانات', member_ids: ['me'] }),
    );
  });
});

describe('JobTitleBadge', () => {
  it('renders the title in a pill', () => {
    render(<JobTitleBadge title="مدیر فروش" />);
    expect(screen.getByTestId('job-title-badge').textContent).toBe('مدیر فروش');
  });

  it('renders nothing for empty or missing titles', () => {
    const { container, rerender } = render(<JobTitleBadge title="" />);
    expect(container.innerHTML).toBe('');
    rerender(<JobTitleBadge title={null} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('job-title-badge')).toBeNull();
  });
});

describe('RoomList new-chat menu', () => {
  it('all three menu items are enabled when handlers are given', () => {
    render(
      <RoomList
        rooms={[]}
        onSelect={vi.fn()}
        onNewDm={vi.fn()}
        onNewGroup={vi.fn()}
        onNewChannel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('room-new-menu-btn'));
    for (const text of ['ارسال پیام شخصی', 'ایجاد گروه گفتگو', 'ایجاد کانال']) {
      const btn = screen.getByText(text).closest('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    }
  });
});
