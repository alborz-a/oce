import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StreamItem } from '../types';
import { StreamChatMessageCard } from '../components/cards/StreamChatMessageCard';
import { StreamTaskActivityCard } from '../components/cards/StreamTaskActivityCard';
import { StreamPhotoBubbleCard } from '../components/cards/StreamPhotoBubbleCard';
import { StreamDocumentCard } from '../components/cards/StreamDocumentCard';
import { StreamMeetingMinutesCard } from '../components/cards/StreamMeetingMinutesCard';

const { mockDownloadWithAuth } = vi.hoisted(() => ({
  mockDownloadWithAuth: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  downloadWithAuth: mockDownloadWithAuth,
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
    AuthImage: ({
      src,
      alt,
      className,
    }: {
      src: string;
      alt?: string;
      className?: string;
    }) => (
      <span
        data-testid="mock-auth-image"
        data-auth-src={src}
        aria-label={alt}
        className={className}
      />
    ),
  };
});

describe('Phase 4 Stream Card Components', () => {
  beforeEach(() => {
    mockDownloadWithAuth.mockReset();
    mockDownloadWithAuth.mockResolvedValue(undefined);
  });

  it('StreamChatMessageCard renders self vs other bubbles, quote preview, reactions, reply, and inline edit', () => {
    const onReply = vi.fn();
    const onReact = vi.fn();
    const onEdit = vi.fn();
    const onOpenTask = vi.fn();

    const selfMsg: StreamItem = {
      id: 'msg-1',
      kind: 'chat',
      createdAt: '2026-11-15T09:05:00Z',
      authorId: 'u-me',
      authorName: 'آرش پیرنیا',
      isCurrentUser: true,
      text: 'سلام تیم',
      quotedEntity: {
        kind: 'task_activity',
        id: 'task-77',
        title: 'بتن ریزی سقف ۳',
        subtitle: 'گزارش اولیه ثبت شد',
      },
      reactions: { '👍': ['u-me', 'u-2'] },
      rawChatMessage: {
        id: 'msg-1',
        room_id: 'room-1',
        author_id: 'u-me',
        author_name: 'آرش پیرنیا',
        text: 'سلام تیم',
        reply_to_id: null,
        document_ids: [],
        created_at: '2026-11-15T09:05:00Z',
        edited_at: null,
        metadata: {},
      },
    };

    const { rerender } = render(
      <StreamChatMessageCard
        item={selfMsg}
        onReply={onReply}
        onReact={onReact}
        onEdit={onEdit}
        onOpenTask={onOpenTask}
        currentUserId="u-me"
      />,
    );

    const selfCard = screen.getByTestId('stream-card-chat-msg-1');
    expect(selfCard.className).toContain('chat-item-right');
    expect(screen.getByText('سلام تیم')).toBeInTheDocument();

    fireEvent.click(screen.getByText('بتن ریزی سقف ۳'));
    expect(onOpenTask).toHaveBeenCalledWith('task-77');

    fireEvent.click(screen.getByRole('button', { name: /واکنش 👍/ }));
    expect(onReact).toHaveBeenCalledWith(selfMsg, '👍');

    fireEvent.click(screen.getByRole('button', { name: 'پاسخ' }));
    expect(onReply).toHaveBeenCalledWith(selfMsg);

    fireEvent.click(screen.getByRole('button', { name: 'ویرایش' }));
    const editor = screen.getByLabelText('متن ویرایش پیام');
    fireEvent.change(editor, { target: { value: 'سلام تیم بروزرسانی شد' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }));
    expect(onEdit).toHaveBeenCalledWith(selfMsg, 'سلام تیم بروزرسانی شد');

    const otherMsg: StreamItem = {
      ...selfMsg,
      id: 'msg-2',
      authorId: 'u-2',
      authorName: 'سورنا لنگری',
      isCurrentUser: false,
      text: 'انجام شد',
    };
    rerender(
      <StreamChatMessageCard
        item={otherMsg}
        onReply={onReply}
        onReact={onReact}
        onEdit={onEdit}
        currentUserId="u-me"
      />,
    );

    const otherCard = screen.getByTestId('stream-card-chat-msg-2');
    expect(otherCard.className).toContain('chat-item-left');
    expect(screen.getByText('سورنا لنگری')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ویرایش' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'واکنش' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '🎉' }));
    expect(onReact).toHaveBeenCalledWith(otherMsg, '🎉');
  });

  it('StreamTaskActivityCard renders pill, report block, clickable task title, reply, and reaction', () => {
    const onReply = vi.fn();
    const onReact = vi.fn();
    const onOpenTask = vi.fn();

    const item: StreamItem = {
      id: 'act-1',
      kind: 'task_activity',
      createdAt: '2026-11-15T10:15:00Z',
      authorName: 'محبوبه کرامت',
      isCurrentUser: false,
      rawTaskActivity: {
        taskId: 'task-10',
        taskTitle: 'کنتور آب و برق سرداران',
        actorName: 'محبوبه کرامت',
        actionText: 'را تغییر داد',
        isReport: true,
        reportText: 'پرونده به اداره برق جنوب ارسال شد.',
      },
    };

    render(
      <StreamTaskActivityCard
        item={item}
        onReply={onReply}
        onReact={onReact}
        onOpenTask={onOpenTask}
      />,
    );

    expect(screen.getByText('گزارش جدید:')).toBeInTheDocument();
    expect(screen.getByText('پرونده به اداره برق جنوب ارسال شد.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '«کنتور آب و برق سرداران»' }));
    expect(onOpenTask).toHaveBeenCalledWith('task-10');

    fireEvent.click(screen.getByRole('button', { name: 'پاسخ' }));
    expect(onReply).toHaveBeenCalledWith(item);
  });

  it('StreamPhotoBubbleCard routes images via AuthImage, supports album caption + reply/comment/react below photo', () => {
    const onReply = vi.fn();
    const onReact = vi.fn();
    const onOpenPhoto = vi.fn();

    const item: StreamItem = {
      id: 'album-1',
      kind: 'photo',
      createdAt: '2026-11-15T13:20:00Z',
      authorName: 'سورنا لنگری',
      isCurrentUser: false,
      text: 'بتن ریزی سقف ۳',
      rawPhotos: [
        {
          id: 'ph-1',
          project_id: 'p-1',
          filename: 'roof1.jpg',
          caption: 'بتن ریزی سقف ۳',
          created_at: '2026-11-15T13:20:00Z',
        },
        {
          id: 'ph-2',
          project_id: 'p-1',
          filename: 'roof2.jpg',
          created_at: '2026-11-15T13:20:01Z',
        },
      ],
    };

    render(
      <StreamPhotoBubbleCard
        item={item}
        replyCount={3}
        onReply={onReply}
        onReact={onReact}
        onOpenPhoto={onOpenPhoto}
      />,
    );

    const imgs = screen.getAllByTestId('mock-auth-image');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('data-auth-src', '/api/v1/documents/photos/ph-1/thumb/');
    expect(screen.getByText('بتن ریزی سقف ۳')).toBeInTheDocument();
    expect(screen.getByText('۳ نظر')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'بتن ریزی سقف ۳' }));
    expect(onOpenPhoto).toHaveBeenCalledWith(item.rawPhotos, 0);

    fireEvent.click(screen.getByRole('button', { name: 'نظر' }));
    expect(onReply).toHaveBeenCalledWith(item);
  });

  it('StreamDocumentCard displays Persian size in cyan and triggers downloadWithAuth', async () => {
    const onReply = vi.fn();
    const onReact = vi.fn();

    const item: StreamItem = {
      id: 'doc-item-1',
      kind: 'document',
      createdAt: '2026-11-15T12:56:00Z',
      authorName: 'امیرحسین باباگلی',
      isCurrentUser: false,
      text: 'نمونه ۷ روزه سقف ۳',
      rawDocument: {
        id: 'doc-42',
        project_id: 'p-1',
        name: '1405.08.05 گلشنی.pdf',
        file_size: 61 * 1024,
        extension: 'pdf',
      },
    };

    render(
      <StreamDocumentCard
        item={item}
        projectId="p-1"
        onReply={onReply}
        onReact={onReact}
      />,
    );

    expect(screen.getByText('1405.08.05 گلشنی.pdf')).toBeInTheDocument();
    expect(screen.getByText(/حجم فایل: ۶۱ KB/)).toBeInTheDocument();
    expect(screen.getByText('نمونه ۷ روزه سقف ۳')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /دانلود 1405\.08\.05 گلشنی\.pdf/ }));
    await waitFor(() => {
      expect(mockDownloadWithAuth).toHaveBeenCalledWith(
        '/api/v1/documents/doc-42/download/',
        '1405.08.05 گلشنی.pdf',
      );
    });
  });

  it('StreamDocumentCard hides the size line when the size is unknown (non-admin viewer gets file_size 0)', () => {
    const item: StreamItem = {
      id: 'doc-item-2',
      kind: 'document',
      createdAt: '2026-11-22T10:00:00Z',
      authorName: 'کاربر',
      isCurrentUser: false,
      text: 'گزارش-روزانه.txt',
      rawDocument: {
        id: 'doc-43',
        project_id: 'p-1',
        name: 'گزارش-روزانه.txt',
        file_size: 0,
        extension: 'txt',
      },
    } as unknown as StreamItem;

    render(
      <StreamDocumentCard item={item} projectId="p-1" onReply={vi.fn()} onReact={vi.fn()} />,
    );

    expect(screen.getByText('گزارش-روزانه.txt')).toBeInTheDocument();
    expect(screen.queryByText(/حجم فایل/)).not.toBeInTheDocument();
    expect(screen.queryByText(/KB/)).not.toBeInTheDocument();
  });

  it('StreamMeetingMinutesCard displays attendees, Jalali date, and exports minutes PDF with auth', async () => {
    const onReply = vi.fn();
    const onReact = vi.fn();

    const item: StreamItem = {
      id: 'mtg-item-1',
      kind: 'minutes',
      createdAt: '2026-11-15T14:00:00Z',
      authorName: 'مدیر پروژه',
      isCurrentUser: true,
      rawMeeting: {
        meetingId: 'mtg-99',
        title: 'جلسه هماهنگی کارگاه هفته ۳',
        date: '2026-11-15T14:00:00Z',
        attendees: ['آرش پیرنیا', 'سورنا لنگری'],
      },
    };

    render(
      <StreamMeetingMinutesCard
        item={item}
        onReply={onReply}
        onReact={onReact}
      />,
    );

    expect(screen.getByText('صورتجلسه')).toBeInTheDocument();
    expect(screen.getByText('جلسه هماهنگی کارگاه هفته ۳')).toBeInTheDocument();
    expect(screen.getByText(/حاضرین: آرش پیرنیا، سورنا لنگری/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /دانلود PDF صورتجلسه/ }));
    await waitFor(() => {
      expect(mockDownloadWithAuth).toHaveBeenCalledWith(
        '/api/v1/meetings/mtg-99/minutes/export/pdf/',
        'minutes_mtg-99.pdf',
      );
    });
  });
});
