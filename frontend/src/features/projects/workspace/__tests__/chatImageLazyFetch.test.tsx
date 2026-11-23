import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { RawFileChips } from '../components/cards/StreamChatMessageCard';
import type { RawFileChip } from '../lib/rawFileTag';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api')>();
  return { ...actual, apiGet: mockApiGet };
});

const KEY = 'mizito/general/chats/63d8b0aea17ee55f8f99f3db/files/aaa.jpg';
const PRESIGNED = 'https://storage.example.test/chat/aaa.jpg?X-Amz-Signature=test';
const IMAGE: RawFileChip = { name: 'photo.jpg', key: KEY, icon: 'image' };

let ioCallback: IntersectionObserverCallback | null = null;
let ioDisconnected = false;

class FakeIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    ioDisconnected = true;
  }
  takeRecords() {
    return [];
  }
}

function renderChips() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RawFileChips files={[IMAGE]} />
    </QueryClientProvider>,
  );
}

describe('chat image presigned URL is fetched lazily', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({ url: PRESIGNED });
    ioCallback = null;
    ioDisconnected = false;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not request the URL while the photo is off screen', () => {
    renderChips();
    expect(screen.getByRole('button', { name: 'photo.jpg' })).toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('requests the URL once the photo scrolls near the viewport, then disconnects', async () => {
    renderChips();
    expect(mockApiGet).not.toHaveBeenCalled();
    act(() => {
      ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    expect(mockApiGet).toHaveBeenCalledWith(`/v1/documents/chat-file-url/?key=${encodeURIComponent(KEY)}`);
    expect(ioDisconnected).toBe(true);
  });
});
