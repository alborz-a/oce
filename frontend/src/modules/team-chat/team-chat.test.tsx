// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { RoomList, orderRooms } from './RoomList';
import { MessageList } from './MessageList';
import { POLL_INTERVAL_MS, reconnectDelay, useChatSocket } from './useChatSocket';
import { manifest } from './manifest';

vi.mock('@/shared/lib/api', () => ({ downloadWithAuth: vi.fn(() => Promise.resolve()) }));
vi.mock('@/stores/useAuthStore', () => ({ useAuthStore: { getState: () => ({ accessToken: 'tok' }) } }));

const room = (id, kind, name, extra = {}) => ({ id, kind, name, unread: 0, ...extra });

describe('room list ordering', () => {
  it('puts the company room first, then projects, groups and DMs; newest first inside a kind', () => {
    const rooms = [
      room('d1', 'dm', 'علی'),
      room('g1', 'group', 'گروه'),
      room('p-old', 'project', 'الف', { last_message_at: '2022-01-01T00:00:00Z' }),
      room('p-new', 'project', 'ب', { last_message_at: '2023-01-01T00:00:00Z' }),
      room('c', 'company', 'شرکت'),
    ];
    expect(orderRooms(rooms).map((r) => r.id)).toEqual(['c', 'p-new', 'p-old', 'g1', 'd1']);
  });

  it('shows the unread badge only for rooms with unread messages and reports selection', () => {
    const onSelect = vi.fn();
    render(<RoomList rooms={[room('c', 'company', 'شرکت', { unread: 3 }), room('g', 'group', 'تیم')]} onSelect={onSelect} />);
    expect(screen.getAllByTestId('unread-badge')).toHaveLength(1);
    screen.getByText('تیم').click();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'g' }));
  });
});

describe('RTL rendering', () => {
  it('renders every message body and quote with dir="auto"', () => {
    const msgs = [
      { id: 'm1', room_id: 'r', author_name: 'علی', text: 'سلام', document_ids: [], created_at: '2023-03-01T08:30:00Z' },
      { id: 'm2', room_id: 'r', author_name: 'Bob', text: 'hello', reply_to_id: 'm1', document_ids: ['d1'], created_at: '2023-03-01T08:31:00Z' },
    ];
    const { container } = render(<MessageList messages={msgs} hasMore={false} loadingOlder={false} onLoadOlder={() => {}} />);
    const bodies = container.querySelectorAll('p');
    expect(bodies).toHaveLength(2);
    bodies.forEach((p) => expect(p.getAttribute('dir')).toBe('auto'));
    expect(screen.getByTestId('reply-quote').getAttribute('dir')).toBe('auto');
  });
});

class FakeSocket {
  static instances = [];
  readyState = 0;
  sent = [];
  constructor(url) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  send(d) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  say(obj) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

describe('socket reconnect and polling fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('backs off exponentially up to 30 seconds', () => {
    expect([0, 1, 2, 3, 10].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 30000]);
  });

  it('sends the auth frame first and becomes open after ready', () => {
    const { result } = renderHook(() => useChatSocket({ enabled: true, roomIds: ['r1'], onEvent: () => {}, onPoll: () => {} }));
    const ws = FakeSocket.instances[0];
    act(() => ws.open());
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'auth', token: 'tok' });
    act(() => ws.say({ event: 'ready' }));
    expect(result.current).toBe('open');
    expect(JSON.parse(ws.sent[1])).toEqual({ type: 'subscribe', room_ids: ['r1'] });
  });

  it('polls every 15 s while the socket is down, stops when it is open, and reconnects after a drop', () => {
    const onPoll = vi.fn();
    renderHook(() => useChatSocket({ enabled: true, roomIds: [], onEvent: () => {}, onPoll }));
    const first = FakeSocket.instances[0];
    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS));
    expect(onPoll).toHaveBeenCalledTimes(1); // socket never opened: fallback polling
    act(() => first.open());
    act(() => first.say({ event: 'ready' }));
    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS * 2));
    expect(onPoll).toHaveBeenCalledTimes(1); // open: no polling
    act(() => first.close()); // drop
    act(() => vi.advanceTimersByTime(1000));
    expect(FakeSocket.instances).toHaveLength(2); // reconnected
  });
});

describe('manifest', () => {
  it('registers the chat routes, the sidebar row and Persian strings', () => {
    expect(manifest.routes.map((r) => r.path)).toEqual(['/chat', '/chat/:roomId', '/projects/:projectId/chat']);
    expect(manifest.navItems[0].to).toBe('/chat');
    expect(manifest.translations.fa['team_chat.title']).toBe('گفتگو');
    expect(manifest.translations.fa['team_chat.project_chat']).toBe('گفتگوی پروژه');
  });
});
