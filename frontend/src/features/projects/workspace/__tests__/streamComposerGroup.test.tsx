import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as documentsApi from '@/features/documents/api';
import * as meetingsApi from '@/features/meetings/api';
import * as tasksApi from '@/features/tasks/api';
import { ProjectStreamComposer } from '../components/ProjectStreamComposer';
import { ProjectGroupTab } from '../components/ProjectGroupTab';
import type { ProjectMemberSummary } from '../components/ProjectBoardTab';
import type { ProjectTaskItem, StreamItem } from '../types';

const mockSendMessage = vi.fn().mockResolvedValue({ id: 'msg-new' });
const mockEditMessage = vi.fn().mockResolvedValue({ id: 'msg-1' });
const mockToggleReaction = vi.fn().mockResolvedValue({ id: 'msg-1' });
const mockMarkRead = vi.fn().mockResolvedValue(undefined);
const mockLoadOlder = vi.fn().mockResolvedValue(undefined);
const mockRefreshStream = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useProjectWorkspaceRoom', () => ({
  useProjectWorkspaceRoom: () => ({
    room: { id: 'room-1', kind: 'project', name: 'گروه', unread: 0 },
    messages: [],
    loading: false,
    error: null,
    socketStatus: 'connected',
    hasMore: false,
    loadingOlder: false,
    initialLastReadAt: null,
    initialUnreadCount: 0,
    dismissUnreadSeparator: vi.fn(),
    loadOlder: mockLoadOlder,
    refreshMessages: vi.fn(),
    markRead: mockMarkRead,
    sendMessage: mockSendMessage,
    editMessage: mockEditMessage,
    toggleReaction: mockToggleReaction,
  }),
}));

const sampleStreamItems: StreamItem[] = [
  {
    id: 'chat-1',
    kind: 'chat',
    createdAt: '2026-11-16T08:00:00Z',
    authorId: 'u-2',
    authorName: 'محبوبه کرامت',
    isCurrentUser: false,
    text: 'گزارش امروز ارسال شد',
    rawChatMessage: {
      id: 'chat-msg-1',
      room_id: 'room-1',
      author_id: 'u-2',
      author_name: 'محبوبه کرامت',
      text: 'گزارش امروز ارسال شد',
      document_ids: [],
      created_at: '2026-11-16T08:00:00Z',
    },
  },
  {
    id: 'photo-1',
    kind: 'photo',
    createdAt: '2026-11-16T08:10:00Z',
    authorId: 'u-2',
    authorName: 'سورنا لنگری',
    isCurrentUser: false,
    rawPhotos: [
      {
        id: 'p-1',
        project_id: 'proj-1',
        filename: 'slab.jpg',
        caption: 'بتن‌ریزی سقف ۳',
        created_at: '2026-11-16T08:10:00Z',
      },
    ],
  },
];

vi.mock('../hooks/useProjectWorkspaceStream', () => ({
  useProjectWorkspaceStream: () => ({
    items: sampleStreamItems,
    allItems: sampleStreamItems,
    loading: false,
    error: null,
    replyCountsByItemId: {},
    refresh: mockRefreshStream,
  }),
}));

vi.mock('../components/ProjectStreamFilterBar', () => ({
  ProjectStreamFilterBar: ({ filter, onChange }: { filter: { search: string }; onChange: (n: unknown) => void }) => (
    <div data-testid="mock-filter-bar">
      <input
        data-testid="mock-filter-input"
        value={filter.search}
        onChange={(e) => onChange({ ...filter, search: e.target.value })}
      />
    </div>
  ),
}));

vi.mock('../components/ProjectStreamList', () => ({
  ProjectStreamList: ({
    items,
    onReply,
    onReact,
    onOpenTask,
    onOpenPhoto,
  }: {
    items: StreamItem[];
    onReply: (item: StreamItem) => void;
    onReact: (item: StreamItem, emoji: string) => void;
    onOpenTask?: (taskId: string) => void;
    onOpenPhoto?: (photos: NonNullable<StreamItem['rawPhotos']>, idx: number) => void;
  }) => (
    <div data-testid="mock-stream-list">
      {items.map((it) => (
        <div key={it.id} data-testid={`stream-item-${it.id}`}>
          <button type="button" onClick={() => onReply(it)} data-testid={`reply-${it.id}`}>
            پاسخ
          </button>
          <button type="button" onClick={() => onReact(it, '👍')} data-testid={`react-${it.id}`}>
            واکنش
          </button>
          {it.rawPhotos && (
            <button
              type="button"
              onClick={() => onOpenPhoto?.(it.rawPhotos!, 0)}
              data-testid={`open-photo-${it.id}`}
            >
              نمایش عکس
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onOpenTask?.('task-1')} data-testid="open-task-1">
        باز کردن وظیفه
      </button>
    </div>
  ),
}));

vi.mock('@/features/documents/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/documents/api')>();
  return {
    ...actual,
    uploadDocument: vi.fn().mockResolvedValue({ id: 'doc-uploaded-1', name: 'plan.pdf' }),
  };
});

vi.mock('@/features/tasks/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/api')>();
  return {
    ...actual,
    createTask: vi.fn().mockResolvedValue({ id: 't-created', status: 'draft' }),
    updateTask: vi.fn().mockResolvedValue({ id: 't-created', status: 'open' }),
  };
});

vi.mock('@/features/meetings/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/meetings/api')>();
  return {
    ...actual,
    createMeeting: vi.fn().mockResolvedValue({ id: 'm-created' }),
  };
});

vi.mock('@/features/file-manager/components/MediaLightbox', () => ({
  MediaLightbox: ({ open, items }: { open: boolean; items: Array<{ name: string }> }) =>
    open ? <div data-testid="mock-media-lightbox">{items[0]?.name}</div> : null,
}));

const sampleMembers: ProjectMemberSummary[] = [
  { user_id: 'u-1', full_name: 'آرش پیرنیا', email: 'arash@royalstars.co', role: 'admin' },
  { user_id: 'u-2', full_name: 'محبوبه کرامت', email: 'maryam@royalstars.co', role: 'member' },
];

const sampleTasks: ProjectTaskItem[] = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    title: 'پیگیری انشعاب برق',
    status: 'open',
    created_at: '2026-11-10T08:00:00Z',
  },
];

describe('ProjectStreamComposer & ProjectGroupTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    });
  });

  it('ProjectStreamComposer sends Enter text, uploads file attachment, handles mentions, and opens native <dialog> for + وظیفه & + صورتجلسه', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onCancelReply = vi.fn();
    const onTasksChanged = vi.fn();
    const onMeetingsChanged = vi.fn();

    render(
      <ProjectStreamComposer
        projectId="proj-1"
        currentUser={{ id: 'u-1', full_name: 'آرش پیرنیا' }}
        members={sampleMembers}
        tasks={sampleTasks}
        replyTo={sampleStreamItems[1]!}
        onCancelReply={onCancelReply}
        onSend={onSend}
        onTasksChanged={onTasksChanged}
        onMeetingsChanged={onMeetingsChanged}
      />,
    );

    // Reply bar shows for quoted photo item
    expect(screen.getByTestId('composer-reply-preview')).toHaveTextContent('سورنا لنگری');

    // Attach file via hidden file input
    const file = new File(['pdf-bytes'], 'plan.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('composer-file-input'), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(documentsApi.uploadDocument).toHaveBeenCalledWith('proj-1', file, 'other'),
    );
    expect(screen.getByTestId('composer-attachments')).toHaveTextContent('plan.pdf');

    // Mention colleague
    fireEvent.click(screen.getByTestId('composer-mention-btn'));
    fireEvent.click(within(screen.getByTestId('composer-mention-popover')).getByText('محبوبه کرامت'));

    // Enter sends message with quotedEntity (since photo item has no rawChatMessage)
    const input = screen.getByTestId('composer-text-input');
    fireEvent.change(input, { target: { value: 'لطفا بررسی شود' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'لطفا بررسی شود',
          documentIds: ['doc-uploaded-1'],
          mentions: ['u-2'],
          replyToId: null,
          quotedEntity: expect.objectContaining({
            kind: 'photo',
            id: 'p-1',
            title: 'بتن‌ریزی سقف ۳',
          }),
        }),
      ),
    );
    expect(onCancelReply).toHaveBeenCalled();

    // + وظیفه native <dialog>
    fireEvent.click(screen.getByTestId('composer-quick-task-btn'));
    const taskDlg = screen.getByTestId('composer-task-dialog');
    expect(taskDlg).not.toHaveAttribute('role');
    expect(taskDlg).not.toHaveAttribute('aria-modal');
    fireEvent.change(screen.getByTestId('composer-task-title-input'), {
      target: { value: 'وظیفه از کامپوزر' },
    });
    fireEvent.click(screen.getByTestId('composer-task-submit'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 'proj-1', title: 'وظیفه از کامپوزر' }),
      ),
    );
    expect(onTasksChanged).toHaveBeenCalled();

    // + صورتجلسه native <dialog>
    fireEvent.click(screen.getByTestId('composer-quick-minutes-btn'));
    const minutesDlg = screen.getByTestId('composer-minutes-dialog');
    expect(minutesDlg).not.toHaveAttribute('role');
    fireEvent.change(screen.getByTestId('composer-minutes-title-input'), {
      target: { value: 'جلسه هماهنگی کارگاه' },
    });
    fireEvent.click(screen.getByTestId('composer-minutes-submit'));
    await waitFor(() =>
      expect(meetingsApi.createMeeting).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-1',
          title: 'جلسه هماهنگی کارگاه',
        }),
      ),
    );
    expect(onMeetingsChanged).toHaveBeenCalled();
  });

  it('ProjectGroupTab integrates room, stream, reply, reactions, MediaLightbox, and TaskQuickDetailDialog', async () => {
    render(
      <ProjectGroupTab
        projectId="proj-1"
        currentUserId="u-1"
        currentUser={{ id: 'u-1', full_name: 'آرش پیرنیا' }}
        tasks={sampleTasks}
        members={sampleMembers}
      />,
    );

    expect(mockMarkRead).toHaveBeenCalled();

    // Reaction on chat message calls toggleReaction
    fireEvent.click(screen.getByTestId('react-chat-1'));
    expect(mockToggleReaction).toHaveBeenCalledWith('chat-msg-1', '👍', 'u-1');

    // Reply on chat message populates composer reply bar and sends replyToId
    fireEvent.click(screen.getByTestId('reply-chat-1'));
    expect(screen.getByTestId('composer-reply-preview')).toHaveTextContent('محبوبه کرامت');

    const input = screen.getByTestId('composer-text-input');
    fireEvent.change(input, { target: { value: 'دریافت شد' } });
    fireEvent.click(screen.getByTestId('composer-send-btn'));
    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'دریافت شد',
          replyToId: 'chat-msg-1',
        }),
      ),
    );

    // Clicking photo opens MediaLightbox
    fireEvent.click(screen.getByTestId('open-photo-photo-1'));
    expect(screen.getByTestId('mock-media-lightbox')).toHaveTextContent('بتن‌ریزی سقف ۳');

    // Clicking task opens TaskQuickDetailDialog
    fireEvent.click(screen.getByTestId('open-task-1'));
    expect(screen.getByTestId('task-quick-detail-dialog')).toHaveAttribute('open');
  });
});
