import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { apiGet } from '@/shared/lib/api';
import type { ChatMessage } from '@/modules/team-chat/types';
import type { ProjectPhotoItem, StreamItem } from '../types';
import { buildStreamItems } from '../hooks/useProjectWorkspaceStream';
import { StreamPhotoBubbleCard } from '../components/cards/StreamPhotoBubbleCard';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
}));

type BuildInput = Parameters<typeof buildStreamItems>[0];

// The photo list is capped at 200 rows; the project has 300 photos.
const LOADED_PHOTOS = Array.from({ length: 200 }, (_, i) => ({
  id: `p-${i}`,
  project_id: 'proj-1',
  filename: `photo-${i}.jpg`,
  document_id: null,
})) as unknown as ProjectPhotoItem[];

function message(partial: Record<string, unknown>): ChatMessage {
  return {
    id: 'msg-1',
    text: '',
    created_at: '2026-11-01T10:00:00Z',
    author_id: 'user-other',
    author_name: 'کاربر تست',
    document_ids: [],
    metadata: {},
    ...partial,
  } as unknown as ChatMessage;
}

function build(messages: ChatMessage[]): StreamItem[] {
  const input = {
    currentUserId: 'user-me',
    roomMessages: messages,
    tasks: [],
    members: [],
    sources: {
      comments: [],
      timeline: [],
      photos: LOADED_PHOTOS,
      documents: [],
      meetings: [],
    },
  } as unknown as BuildInput;
  return buildStreamItems(input).allItems;
}

function renderCard(item: StreamItem) {
  return render(
    <StreamPhotoBubbleCard
      item={item}
      onReply={() => {}}
      onReact={() => {}}
    />,
  );
}

describe('chat photo attachments resolved by id', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
  });

  it('renders message with photo id 250 of 300 through the id lookup', async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) => {
      if (path === '/v1/documents/photos/p-250/thumb-url/') {
        return { url: 'https://files.test/p-250-thumb.jpg' };
      }
      throw new Error(`unexpected ${path}`);
    });

    const items = build([message({ id: 'msg-250', document_ids: ['p-250'] })]);
    const item = items.find((i) => i.id === 'msg-250');
    expect(item?.kind).toBe('photo');
    expect(item?.pendingPhotoIds).toEqual(['p-250']);

    const { container } = renderCard(item!);
    await waitFor(() => {
      expect(container.querySelector('img[src="https://files.test/p-250-thumb.jpg"]')).not.toBeNull();
    });
  });

  it('renders the unavailable placeholder when the id cannot be resolved', async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error('404'));

    const items = build([message({ id: 'msg-missing', document_ids: ['p-missing'] })]);
    const item = items.find((i) => i.id === 'msg-missing');
    expect(item?.kind).toBe('photo');

    renderCard(item!);
    await waitFor(() => {
      expect(screen.getByText('تصویر در دسترس نیست')).toBeInTheDocument();
    });
  });

  it('skips an empty-text message with no attachment', () => {
    const items = build([message({ id: 'msg-empty', text: '   ', document_ids: [] })]);
    expect(items.find((i) => i.id === 'msg-empty')).toBeUndefined();
  });
});
