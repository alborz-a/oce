import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RawFileChips } from '../components/cards/StreamChatMessageCard';
import { useToastStore } from '@/stores/useToastStore';
import type { RawFileChip } from '../lib/rawFileTag';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api')>();
  return { ...actual, apiGet: mockApiGet };
});

const KEY = 'mizito/general/chats/63d8b0aea17ee55f8f99f3db/files/699b13b18cecd750.pdf';
const PRESIGNED = 'https://storage.example.test/chat/file.pdf?X-Amz-Signature=test';

function renderChips(files: RawFileChip[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RawFileChips files={files} />
    </QueryClientProvider>,
  );
}

describe('RawFileChips', () => {
  let win: { location: { href: string }; opener: unknown; close: ReturnType<typeof vi.fn> };
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockApiGet.mockReset();
    useToastStore.setState({ toasts: [] });
    win = { location: { href: '' }, opener: undefined, close: vi.fn() };
    openSpy = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('click resolves the presigned URL and opens the PDF in the blank tab', async () => {
    mockApiGet.mockResolvedValue({ url: PRESIGNED });
    renderChips([{ name: '1403.10.02 بسیج 18.pdf', key: KEY, icon: 'picture_as_pdf' }]);

    fireEvent.click(screen.getByRole('button', { name: /1403\.10\.02 بسیج 18\.pdf/ }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(mockApiGet).toHaveBeenCalledWith(`/v1/documents/chat-file-url/?key=${encodeURIComponent(KEY)}`);
    await waitFor(() => expect(win.location.href).toBe(PRESIGNED));
    expect(win.opener).toBeNull();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('shows a Farsi error toast and closes the tab when the presign fails', async () => {
    mockApiGet.mockRejectedValue(new Error('network'));
    renderChips([{ name: 'بسیج.pdf', key: KEY, icon: 'picture_as_pdf' }]);

    fireEvent.click(screen.getByRole('button', { name: /بسیج\.pdf/ }));

    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(win.close).toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'error', title: 'باز کردن فایل ناموفق بود' });
  });

  it('shows the error toast without opening anything when the chip has no storage key', () => {
    renderChips([{ name: 'بدون-کلید.pdf', key: null, icon: 'picture_as_pdf' }]);

    fireEvent.click(screen.getByRole('button', { name: /بدون-کلید\.pdf/ }));

    expect(openSpy).not.toHaveBeenCalled();
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});
