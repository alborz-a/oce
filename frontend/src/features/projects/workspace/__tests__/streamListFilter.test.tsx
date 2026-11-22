import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_STREAM_FILTERS, type StreamFilterState, type StreamItem } from '../types';
import {
  ProjectStreamFilterBar,
  type ProjectMemberSummary,
} from '../components/ProjectStreamFilterBar';
import { formatJalaliDateLabel, ProjectStreamList } from '../components/ProjectStreamList';

vi.mock('@/shared/lib/api', () => ({
  downloadWithAuth: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    AuthImage: ({ src, alt }: { src: string; alt?: string }) => (
      <span data-testid="mock-auth-image" data-auth-src={src} aria-label={alt} />
    ),
  };
});

describe('ProjectStreamFilterBar', () => {
  const members: ProjectMemberSummary[] = [
    { user_id: 'u-1', full_name: 'آرش پیرنیا' },
    { user_id: 'u-2', full_name: 'محبوبه کرامت' },
  ];

  it('renders <search>, 9 filter controls, sender & date popovers, kind toggles, and reset button', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ProjectStreamFilterBar
        filter={DEFAULT_STREAM_FILTERS}
        onChange={onChange}
        members={members}
        totalCount={12}
        filteredCount={12}
      />,
    );

    const searchInput = screen.getByLabelText('فیلتر پیام‌ها');
    expect(searchInput.closest('search')).not.toBeNull();

    fireEvent.change(searchInput, { target: { value: 'کنتور' } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_STREAM_FILTERS,
      search: 'کنتور',
    });

    // Open sender picker and choose a member
    fireEvent.click(screen.getByRole('button', { name: 'فیلتر بر اساس فرستنده' }));
    fireEvent.click(screen.getByRole('button', { name: 'محبوبه کرامت' }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_STREAM_FILTERS,
      senderId: 'u-2',
    });

    // Open date range picker and apply 7-day preset
    fireEvent.click(screen.getByRole('button', { name: 'فیلتر بازه تاریخ' }));
    fireEvent.click(screen.getByRole('button', { name: '۷ روز گذشته' }));
    const presetArg = onChange.mock.calls.at(-1)?.[0] as StreamFilterState;
    expect(presetArg.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(presetArg.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Toggle photos kind
    fireEvent.click(screen.getByRole('button', { name: 'فقط عکس‌ها و آلبوم‌ها' }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_STREAM_FILTERS,
      kind: 'photos',
    });

    // When active filter is present, show count + clear button
    rerender(
      <ProjectStreamFilterBar
        filter={{ ...DEFAULT_STREAM_FILTERS, kind: 'photos' }}
        onChange={onChange}
        members={members}
        totalCount={12}
        filteredCount={3}
      />,
    );

    expect(screen.getByText('۳ از ۱۲ مورد')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'پاک کردن فیلترها' }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_STREAM_FILTERS);
  });
});

describe('ProjectStreamList', () => {
  it('formats relative Jalali date separator pills with Persian digits', () => {
    const refNow = new Date(2026, 10, 15, 14, 0, 0);
    const sameDay = new Date(2026, 10, 15, 9, 0, 0).toISOString();
    const yesterday = new Date(2026, 10, 14, 9, 0, 0).toISOString();
    const oneMonthAgo = new Date(2026, 9, 12, 9, 0, 0).toISOString();

    expect(formatJalaliDateLabel(sameDay, refNow)).toContain('(امروز)');
    expect(formatJalaliDateLabel(yesterday, refNow)).toContain('(دیروز)');
    expect(formatJalaliDateLabel(oneMonthAgo, refNow)).toContain('(یک ماه قبل)');
  });

  it('renders date groups, single unread divider after lastReadAt, load-more, and all 5 card types', () => {
    const onLoadMore = vi.fn();
    const onReply = vi.fn();
    const onReact = vi.fn();

    const items: StreamItem[] = [
      {
        id: 'm-old',
        kind: 'chat',
        createdAt: '2026-11-14T08:00:00Z',
        authorName: 'آرش',
        isCurrentUser: true,
        text: 'پیام قدیمی',
      },
      {
        id: 'm-new-self',
        kind: 'task_activity',
        createdAt: '2026-11-15T09:00:00Z',
        authorName: 'آرش',
        isCurrentUser: true,
        rawTaskActivity: {
          taskId: 't-1',
          taskTitle: 'شاهد ۹',
          actorName: 'آرش',
          actionText: 'را تغییر داد',
          isReport: true,
          reportText: 'گزارش جدید ثبت شد',
        },
      },
      {
        id: 'm-new-other',
        kind: 'chat',
        createdAt: '2026-11-15T10:00:00Z',
        authorName: 'سورنا',
        isCurrentUser: false,
        text: 'پاسخ به پیام قدیمی',
        replyTo: { id: 'm-old', authorName: 'آرش', text: 'پیام قدیمی' },
      },
      {
        id: 'ph-item',
        kind: 'photo',
        createdAt: '2026-11-15T11:00:00Z',
        authorName: 'سورنا',
        isCurrentUser: false,
        text: 'بتن ریزی',
        rawPhotos: [
          {
            id: 'ph-1',
            project_id: 'p-1',
            filename: 'a.jpg',
            created_at: '2026-11-15T11:00:00Z',
          },
        ],
      },
      {
        id: 'doc-item',
        kind: 'document',
        createdAt: '2026-11-15T12:00:00Z',
        authorName: 'باباگلی',
        isCurrentUser: false,
        rawDocument: { id: 'd-1', project_id: 'p-1', name: 'plan.pdf', file_size: 2048 },
      },
      {
        id: 'mtg-item',
        kind: 'minutes',
        createdAt: '2026-11-15T13:00:00Z',
        authorName: 'مدیر',
        isCurrentUser: true,
        rawMeeting: { meetingId: 'mtg-1', title: 'صورتجلسه هفتگی', attendees: ['آرش'] },
      },
    ];

    render(
      <ProjectStreamList
        projectId="p-1"
        items={items}
        lastReadAt="2026-11-15T08:30:00Z"
        hasMore
        onLoadMore={onLoadMore}
        onReply={onReply}
        onReact={onReact}
        replyCountsByItemId={{ 'ph-item': 4 }}
      />,
    );

    // Load older button works
    fireEvent.click(screen.getByRole('button', { name: /بارگذاری پیام‌های قدیمی‌تر/ }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Exactly one unread bar, placed before m-new-other (skipping m-new-self authored by current user)
    const unreadBars = screen.getAllByTestId('stream-unread-bar');
    expect(unreadBars).toHaveLength(1);
    expect(unreadBars[0]).toHaveTextContent('پیام‌های جدید');

    // All 5 card types rendered + replyTarget + photo replyCount
    expect(screen.getByTestId('stream-card-chat-m-old')).toBeInTheDocument();
    expect(screen.getByTestId('stream-card-task-m-new-self')).toBeInTheDocument();
    expect(screen.getByTestId('stream-card-chat-m-new-other')).toBeInTheDocument();
    expect(screen.getByTestId('stream-card-photo-ph-item')).toBeInTheDocument();
    expect(screen.getByText('۴ نظر')).toBeInTheDocument();
    expect(screen.getByTestId('stream-card-doc-doc-item')).toBeInTheDocument();
    expect(screen.getByTestId('stream-card-minutes-mtg-item')).toBeInTheDocument();
  });

  it('renders loading and empty states cleanly', () => {
    const { rerender } = render(
      <ProjectStreamList
        projectId="p-1"
        items={[]}
        loading
        onReply={vi.fn()}
        onReact={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stream-loading')).toBeInTheDocument();

    rerender(
      <ProjectStreamList
        projectId="p-1"
        items={[]}
        loading={false}
        onReply={vi.fn()}
        onReact={vi.fn()}
      />,
    );
    expect(screen.getByTestId('stream-empty')).toBeInTheDocument();
  });
});
