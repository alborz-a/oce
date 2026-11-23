import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '@/shared/lib/api';
import type { ChatMessage } from '@/modules/team-chat/types';
import {
  DEFAULT_STREAM_FILTERS,
  type ProjectDocumentItem,
  type ProjectPhotoItem,
  type ProjectTaskItem,
  type StreamFilterState,
} from '../types';
import {
  buildStreamItems,
  computeReplyCounts,
  filterStreamItems,
  useProjectWorkspaceStream,
  type ProjectMemberSummary,
  type StreamCommentApiItem,
  type StreamMeetingApiItem,
  type StreamTimelineApiItem,
} from '../hooks/useProjectWorkspaceStream';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  downloadWithAuth: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

const MEMBERS: ProjectMemberSummary[] = [
  { user_id: 'u-1', full_name: 'آرش پیرنیا' },
  { user_id: 'u-2', full_name: 'محبوبه کرامت' },
];

const TASKS: ProjectTaskItem[] = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    title: 'آرماتوربندی فونداسیون',
    status: 'in_progress',
    created_at: '2026-03-01T08:00:00Z',
    updated_at: '2026-03-01T08:00:00Z',
    metadata: {
      mizito_history: [
        {
          id: 'mh-1',
          created_at: '2026-03-01T08:30:00Z',
          actor_id: 'u-2',
          action: 'created',
        },
        {
          id: 'mh-dup',
          created_at: '2026-03-01T09:15:00Z',
          actor_id: 'u-1',
          action: 'completed',
        },
      ],
    },
  },
];

const PHOTOS: ProjectPhotoItem[] = [
  {
    id: 'ph-linked',
    project_id: 'proj-1',
    document_id: 'doc-linked-photo',
    filename: 'linked.jpg',
    caption: 'عکس متصل به پیام',
    tags: [],
    created_by: 'u-1',
    created_at: '2026-03-01T10:00:00Z',
    has_thumbnail: true,
  },
  {
    id: 'ph-album-1',
    project_id: 'proj-1',
    document_id: 'doc-album-1',
    filename: 'site1.jpg',
    caption: 'گزارش پیشرفت بتن',
    tags: ['album:site-march'],
    created_by: 'u-2',
    created_at: '2026-03-01T11:00:00Z',
    has_thumbnail: false,
  },
  {
    id: 'ph-album-2',
    project_id: 'proj-1',
    document_id: 'doc-album-2',
    filename: 'site2.jpg',
    caption: '',
    tags: ['album:site-march'],
    created_by: 'u-2',
    created_at: '2026-03-01T11:02:00Z',
    has_thumbnail: true,
  },
  {
    id: 'ph-single',
    project_id: 'proj-1',
    document_id: null,
    filename: 'solo.jpg',
    caption: 'عکس تکی',
    tags: [],
    created_by: 'u-1',
    created_at: '2026-03-01T11:30:00Z',
  },
];

const DOCUMENTS: ProjectDocumentItem[] = [
  {
    id: 'doc-linked-photo',
    project_id: 'proj-1',
    name: 'linked.jpg',
    category: 'photo',
    mime_type: 'image/jpeg',
    uploaded_by: 'u-1',
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'doc-linked-pdf',
    project_id: 'proj-1',
    name: 'plan.pdf',
    category: 'drawing',
    mime_type: 'application/pdf',
    file_size: 204800,
    uploaded_by: 'u-1',
    created_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 'doc-standalone',
    project_id: 'proj-1',
    name: 'contract.pdf',
    description: 'قرارداد نهایی پیمانکار',
    category: 'contract',
    mime_type: 'application/pdf',
    file_size: 102400,
    uploaded_by: 'u-2',
    created_at: '2026-03-01T13:00:00Z',
  },
  {
    id: 'doc-video',
    project_id: 'proj-1',
    name: 'drone-walkthrough.mp4',
    category: 'other',
    mime_type: 'video/mp4',
    uploaded_by: 'u-1',
    created_at: '2026-03-01T13:30:00Z',
  },
];

const COMMENTS: StreamCommentApiItem[] = [
  {
    id: 'c-report',
    entity_type: 'task',
    entity_id: 'task-1',
    author_id: 'u-1',
    author_name: 'آرش پیرنیا',
    text: 'گزارش اجرای فاز اول ثبت شد.',
    created_at: '2026-03-01T14:00:00Z',
  },
  {
    id: 'c-backfilled',
    entity_type: 'task',
    entity_id: 'topic-1',
    author_id: 'u-2',
    author_name: 'محبوبه کرامت',
    text: 'این پیام قبلاً به اتاق گفتگو منتقل شده',
    created_at: '2026-03-01T14:05:00Z',
  },
  {
    id: 'c-deleted',
    entity_type: 'task',
    entity_id: 'task-1',
    author_id: 'u-1',
    author_name: 'آرش پیرنیا',
    text: 'حذف شده',
    is_deleted: true,
    created_at: '2026-03-01T14:10:00Z',
  },
];

const TIMELINE: StreamTimelineApiItem[] = [
  {
    id: 'tl-1',
    entity_type: 'task',
    entity_id: 'task-1',
    action: 'completed',
    actor_id: 'u-1',
    created_at: '2026-03-01T09:15:00Z',
  },
  {
    id: 'tl-non-task',
    entity_type: 'document',
    entity_id: 'doc-standalone',
    action: 'created',
    actor_id: 'u-2',
    created_at: '2026-03-01T13:01:00Z',
  },
];

const MEETINGS: StreamMeetingApiItem[] = [
  {
    id: 'mtg-1',
    project_id: 'proj-1',
    title: 'جلسه هماهنگی هفتگی کارگاه',
    meeting_date: '2026-03-02',
    attendees: [{ full_name: 'آرش پیرنیا' }, 'مهندس حسینی'],
    minutes: 'مصوبات جلسه هفتگی',
    created_by: 'u-2',
    created_at: '2026-03-02T09:00:00Z',
  },
];

const ROOM_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-chat-1',
    room_id: 'room-1',
    author_id: 'u-1',
    author_name: 'آرش پیرنیا',
    text: 'سلام تیم، نقشه تایید شد',
    document_ids: [],
    created_at: '2026-03-01T09:00:00Z',
    metadata: {
      reactions: { '👍': ['u-1', 'u-2'] },
      quoted_entity: {
        kind: 'minutes',
        id: 'meeting:mtg-1',
        title: 'جلسه هماهنگی هفتگی کارگاه',
      },
    },
  },
  {
    id: 'msg-photo',
    room_id: 'room-1',
    author_id: 'u-1',
    author_name: 'آرش پیرنیا',
    text: 'تصویر پیوست‌شده به گفتگو',
    document_ids: ['doc-linked-photo'],
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'msg-doc',
    room_id: 'room-1',
    author_id: 'u-2',
    author_name: 'محبوبه کرامت',
    text: 'نقشه اجرایی جدید',
    document_ids: ['doc-linked-pdf'],
    created_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 'msg-reply',
    room_id: 'room-1',
    author_id: 'u-2',
    author_name: 'محبوبه کرامت',
    text: 'تاییدیه دریافت شد',
    reply_to_id: 'comment:c-report',
    document_ids: [],
    created_at: '2026-03-01T14:30:00Z',
    metadata: {
      poll: { question: 'زمان جلسه بعدی؟' },
    },
  },
  {
    id: 'msg-backfilled',
    room_id: 'room-1',
    author_id: 'u-2',
    author_name: 'محبوبه کرامت',
    text: 'این پیام قبلاً به اتاق گفتگو منتقل شده',
    document_ids: [],
    created_at: '2026-03-01T14:05:00Z',
    metadata: {
      source_id: 'mizito-comment:c-backfilled',
      is_video_call: true,
    },
  },
];

describe('chat message author avatar', () => {
  it('prefers the message avatar_url and falls back to the members photo', () => {
    const base = ROOM_MESSAGES[0]!;
    const msgs: ChatMessage[] = [
      { ...base, id: 'm-with', author_id: 'u-9', author_name: 'Zed', avatar_url: '/api/v1/users/u-9/avatar' },
      { ...base, id: 'm-none', author_id: 'u-9', author_name: 'Zed', avatar_url: null },
    ];
    const members = [
      ...MEMBERS,
      { user_id: 'u-9', full_name: 'Zed', avatar_url: '/member-photo.jpg' } as unknown as ProjectMemberSummary,
    ];
    const { allItems } = buildStreamItems({
      currentUserId: 'u-1',
      roomMessages: msgs,
      tasks: TASKS,
      members,
      sources: { comments: [], timeline: [], photos: [], documents: [], meetings: [] },
    });
    const byId = new Map(allItems.map((i) => [i.id, i]));
    expect(byId.get('m-with')?.authorAvatarUrl).toBe('/api/v1/users/u-9/avatar');
    expect(byId.get('m-none')?.authorAvatarUrl).toBe('/member-photo.jpg');
  });
});

describe('buildStreamItems & filterStreamItems', () => {
  it('merges all sources chronologically, deduplicates linked/backfilled items, groups albums, and computes reply counts', () => {
    const { allItems, replyCountsByItemId } = buildStreamItems({
      currentUserId: 'u-1',
      roomMessages: ROOM_MESSAGES,
      tasks: TASKS,
      members: MEMBERS,
      sources: {
        comments: COMMENTS,
        timeline: TIMELINE,
        photos: PHOTOS,
        documents: DOCUMENTS,
        meetings: MEETINGS,
      },
    });

    const ids = allItems.map((i) => i.id);
    // Ascending chronological timestamps
    for (let i = 1; i < allItems.length; i += 1) {
      const prev = allItems[i - 1]!;
      const curr = allItems[i]!;
      expect(Date.parse(prev.createdAt)).toBeLessThanOrEqual(Date.parse(curr.createdAt));
    }

    // Dedupes linked photo/doc and photo document_id entries from standalone lists
    expect(ids).toContain('msg-photo');
    expect(ids).not.toContain('photo:ph-linked');
    expect(ids).not.toContain('doc:doc-linked-photo');
    expect(ids).toContain('msg-doc');
    expect(ids).not.toContain('doc:doc-linked-pdf');
    expect(ids).toContain('doc:doc-standalone');

    // Dedupes backfilled comment + deleted comment + duplicate timeline/history signature
    expect(ids).toContain('comment:c-report');
    expect(ids).not.toContain('comment:c-backfilled');
    expect(ids).not.toContain('comment:c-deleted');
    expect(ids).toContain('history:task-1:mh-1');
    expect(ids).toContain('timeline:tl-1');
    expect(ids).not.toContain('history:task-1:mh-dup');
    expect(ids).not.toContain('timeline:tl-non-task');

    // Groups `album:site-march` photos into 1 item and leaves untagged standalone photo separate
    const albumItem = allItems.find((i) => i.id === 'album:site-march');
    expect(albumItem?.kind).toBe('photo');
    expect(albumItem?.rawPhotos).toHaveLength(2);
    expect(albumItem?.rawPhotos?.[0]?.thumbnail_url).toBe('/api/v1/documents/photos/ph-album-1/file/');
    expect(albumItem?.text).toBe('گزارش پیشرفت بتن');
    expect(ids).toContain('photo:ph-single');

    // Linked photo & document message shapes preserve auth URLs & chat metadata
    const linkedPhotoItem = allItems.find((i) => i.id === 'msg-photo');
    expect(linkedPhotoItem?.kind).toBe('photo');
    expect(linkedPhotoItem?.rawPhotos?.[0]?.thumbnail_url).toBe(
      '/api/v1/documents/photos/ph-linked/thumb/',
    );
    const linkedDocItem = allItems.find((i) => i.id === 'msg-doc');
    expect(linkedDocItem?.kind).toBe('document');
    expect(linkedDocItem?.rawDocument?.download_url).toBe('/api/v1/documents/doc-linked-pdf/download/');

    // Reply target across item types + replyCountsByItemId (replyTo + quotedEntity)
    const replyMsg = allItems.find((i) => i.id === 'msg-reply');
    expect(replyMsg?.replyTo).toEqual({
      id: 'comment:c-report',
      authorName: 'آرش پیرنیا',
      text: 'گزارش اجرای فاز اول ثبت شد.',
      kind: 'task_activity',
    });
    expect(replyCountsByItemId['comment:c-report']).toBe(1);
    expect(replyCountsByItemId['meeting:mtg-1']).toBe(1);

    const reportItem = allItems.find((i) => i.id === 'comment:c-report');
    expect(reportItem?.rawTaskActivity?.isReport).toBe(true);
    expect(reportItem?.rawTaskActivity?.replyCount).toBe(1);

    // Meeting normalized attendees and PDF route
    const meetingItem = allItems.find((i) => i.id === 'meeting:mtg-1');
    expect(meetingItem?.kind).toBe('minutes');
    expect(meetingItem?.rawMeeting?.attendees).toEqual(['آرش پیرنیا', 'مهندس حسینی']);
    expect(meetingItem?.rawMeeting?.pdfUrl).toBe('/api/v1/meetings/mtg-1/minutes/export/pdf/');
    expect(computeReplyCounts(allItems)['comment:c-report']).toBe(1);
  });

  it('filters items by kind (including videos & polls), senderId, date range, and search text', () => {
    const { allItems } = buildStreamItems({
      currentUserId: 'u-1',
      roomMessages: ROOM_MESSAGES,
      tasks: TASKS,
      members: MEMBERS,
      sources: {
        comments: COMMENTS,
        timeline: TIMELINE,
        photos: PHOTOS,
        documents: DOCUMENTS,
        meetings: MEETINGS,
      },
    });

    const apply = (patch: Partial<StreamFilterState>) =>
      filterStreamItems(allItems, { ...DEFAULT_STREAM_FILTERS, ...patch });

    expect(apply({ kind: 'tasks' }).every((i) => i.kind === 'task_activity')).toBe(true);
    expect(apply({ kind: 'minutes' }).map((i) => i.id)).toEqual(['meeting:mtg-1']);
    expect(apply({ kind: 'photos' }).every((i) => i.kind === 'photo')).toBe(true);
    expect(apply({ kind: 'documents' }).every((i) => i.kind === 'document')).toBe(true);
    expect(apply({ kind: 'videos' }).map((i) => i.id).sort()).toEqual([
      'doc:doc-video',
      'msg-backfilled',
    ]);
    expect(apply({ kind: 'polls' }).map((i) => i.id)).toEqual(['msg-reply']);

    expect(apply({ senderId: 'u-2' }).every((i) => i.authorId === 'u-2')).toBe(true);
    expect(apply({ dateFrom: '2026-03-02', dateTo: '2026-03-02' }).map((i) => i.id)).toEqual([
      'meeting:mtg-1',
    ]);
    expect(apply({ search: 'فونداسیون' }).length).toBeGreaterThanOrEqual(2);
    expect(apply({ search: 'مهندس حسینی' }).map((i) => i.id)).toEqual(['meeting:mtg-1']);
  });
});

describe('useProjectWorkspaceStream hook', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('fetches all 5 project endpoints in parallel and gracefully falls back when individual sources fail', async () => {
    mockedApiGet.mockImplementation(async (url: string) => {
      if (url.includes('/v1/collaboration/comments/')) {
        return { items: COMMENTS, total: COMMENTS.length };
      }
      if (url.includes('/v1/timeline/projects/')) {
        throw new Error('Timeline unavailable');
      }
      if (url.includes('/v1/documents/photos/')) {
        return { items: [PHOTOS[3]], total: 1 };
      }
      if (url.includes('/v1/documents/')) {
        return { items: [DOCUMENTS[2]], total: 1 };
      }
      if (url.includes('/v1/meetings/')) {
        throw new Error('Meetings permission denied');
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { result } = renderHook(
      (props: { filter: StreamFilterState; roomMessages: ChatMessage[] }) =>
        useProjectWorkspaceStream({
          projectId: 'proj-1',
          currentUserId: 'u-1',
          roomMessages: props.roomMessages,
          tasks: TASKS,
          members: MEMBERS,
          filter: props.filter,
        }),
      {
        initialProps: {
          filter: DEFAULT_STREAM_FILTERS,
          roomMessages: [ROOM_MESSAGES[0]!],
        },
      },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedApiGet).toHaveBeenCalledWith(
      '/v1/collaboration/comments/?entity_type=task&project_id=proj-1&limit=500',
    );
    expect(mockedApiGet).toHaveBeenCalledWith('/v1/timeline/projects/proj-1');
    expect(mockedApiGet).toHaveBeenCalledWith('/v1/documents/photos/?project_id=proj-1&limit=200');
    expect(mockedApiGet).toHaveBeenCalledWith('/v1/documents/?project_id=proj-1&limit=200');
    expect(mockedApiGet).toHaveBeenCalledWith('/v1/meetings/?project_id=proj-1&limit=100');

    // Graceful partial failure keeps error null and renders fulfilled items
    expect(result.current.error).toBeNull();
    const ids = result.current.allItems.map((i) => i.id);
    expect(ids).toContain('msg-chat-1');
    expect(ids).toContain('comment:c-report');
    expect(ids).toContain('photo:ph-single');
    expect(ids).toContain('doc:doc-standalone');
  });

  it('surfaces error when all 5 endpoints reject and supports refresh()', async () => {
    mockedApiGet.mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() =>
      useProjectWorkspaceStream({
        projectId: 'proj-1',
        currentUserId: 'u-1',
        roomMessages: [],
        tasks: [],
        members: MEMBERS,
        filter: DEFAULT_STREAM_FILTERS,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('Network failure');
    expect(result.current.items).toEqual([]);

    // Now return meetings on refresh()
    mockedApiGet.mockImplementation(async (url: string) => {
      if (url.includes('/v1/meetings/')) return MEETINGS;
      return { items: [], entries: [], total: 0 };
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.items.map((i) => i.id)).toEqual(['meeting:mtg-1']);
  });

  it('re-fetches documents when a new message references a document id missing from the loaded snapshot', async () => {
    mockedApiGet.mockImplementation(async (url: string) => {
      if (url.includes('/v1/documents/')) return { items: [], total: 0 };
      return { items: [], entries: [], total: 0 };
    });

    const firstMessage: ChatMessage = {
      ...ROOM_MESSAGES[0]!,
      id: 'msg-missing-1',
      document_ids: ['doc-unknown-1'],
    };

    const { result, rerender } = renderHook(
      (props: { roomMessages: ChatMessage[] }) =>
        useProjectWorkspaceStream({
          projectId: 'proj-1',
          currentUserId: 'u-1',
          roomMessages: props.roomMessages,
          tasks: TASKS,
          members: MEMBERS,
          filter: DEFAULT_STREAM_FILTERS,
        }),
      { initialProps: { roomMessages: [firstMessage] } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const docCallsCount = (): number =>
      mockedApiGet.mock.calls.filter((call) => String(call[0]).startsWith('/v1/documents/?')).length;
    const callsBefore = docCallsCount();

    const newMessage: ChatMessage = {
      ...ROOM_MESSAGES[0]!,
      id: 'msg-missing-2',
      document_ids: ['doc-unknown-2'],
    };
    rerender({ roomMessages: [firstMessage, newMessage] });

    await waitFor(() => {
      expect(docCallsCount()).toBeGreaterThan(callsBefore);
    });
  });

  it('re-fetches the project timeline when a new task id appears in tasks', async () => {
    mockedApiGet.mockImplementation(async () => ({ items: [], entries: [], total: 0 }));

    const newTask: ProjectTaskItem = { ...TASKS[0]!, id: 'task-created-now' };

    const { result, rerender } = renderHook(
      (props: { tasks: ProjectTaskItem[] }) =>
        useProjectWorkspaceStream({
          projectId: 'proj-1',
          currentUserId: 'u-1',
          roomMessages: ROOM_MESSAGES,
          tasks: props.tasks,
          members: MEMBERS,
          filter: DEFAULT_STREAM_FILTERS,
        }),
      { initialProps: { tasks: TASKS } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const timelineCallsCount = (): number =>
      mockedApiGet.mock.calls.filter((call) => String(call[0]).startsWith('/v1/timeline/projects/')).length;
    const callsBefore = timelineCallsCount();

    rerender({ tasks: [...TASKS, newTask] });

    await waitFor(() => {
      expect(timelineCallsCount()).toBeGreaterThan(callsBefore);
    });
  });
});
