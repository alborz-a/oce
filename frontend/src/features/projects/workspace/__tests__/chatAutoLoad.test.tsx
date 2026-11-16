import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import {
  AUTO_LOAD_TOP_PX,
  ProjectStreamList,
  scrollTopAfterPrepend,
  shouldAutoLoadOlder,
} from '../components/ProjectStreamList';

vi.mock('@/shared/lib/api', () => ({
  downloadWithAuth: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

let ioCallback: IntersectionObserverCallback | null = null;
const observe = vi.fn();
const disconnect = vi.fn();

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function fireSentinel(intersecting: boolean) {
  if (!ioCallback) throw new Error('observer not created');
  const entry = { isIntersecting: intersecting } as IntersectionObserverEntry;
  ioCallback([entry], {} as IntersectionObserver);
}

function renderList(props: { hasMore: boolean; loadingMore: boolean; onLoadMore: () => void }) {
  return (
    <ProjectStreamList
      projectId="p-1"
      items={[]}
      hasMore={props.hasMore}
      loadingMore={props.loadingMore}
      onLoadMore={props.onLoadMore}
      onReply={() => {}}
      onReact={() => {}}
    />
  );
}

describe('ProjectStreamList auto-load older history', () => {
  beforeEach(() => {
    ioCallback = null;
    observe.mockClear();
    disconnect.mockClear();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sentinel intersecting triggers onLoadMore once', () => {
    const onLoadMore = vi.fn();
    render(renderList({ hasMore: true, loadingMore: false, onLoadMore }));
    expect(observe).toHaveBeenCalledTimes(1);

    act(() => fireSentinel(true));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when hasMore is false', () => {
    const onLoadMore = vi.fn();
    render(renderList({ hasMore: false, loadingMore: false, onLoadMore }));
    expect(observe).not.toHaveBeenCalled();
    expect(ioCallback).toBeNull();
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not trigger while a load is already running', () => {
    const onLoadMore = vi.fn();
    render(renderList({ hasMore: true, loadingMore: true, onLoadMore }));

    act(() => fireSentinel(true));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('keeps one request in flight until loadingMore cycles back to false', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(renderList({ hasMore: true, loadingMore: false, onLoadMore }));

    act(() => fireSentinel(true));
    act(() => fireSentinel(true));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(renderList({ hasMore: true, loadingMore: true, onLoadMore }));
    rerender(renderList({ hasMore: true, loadingMore: false, onLoadMore }));
    act(() => fireSentinel(true));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it('does not observe when IntersectionObserver is unavailable (jsdom)', () => {
    vi.unstubAllGlobals();
    const onLoadMore = vi.fn();
    expect(() => render(renderList({ hasMore: true, loadingMore: false, onLoadMore }))).not.toThrow();
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('manual button still calls onLoadMore', () => {
    const onLoadMore = vi.fn();
    const { getByRole } = render(renderList({ hasMore: true, loadingMore: false, onLoadMore }));
    act(() => getByRole('button', { name: /بارگذاری پیام‌های قدیمی‌تر/ }).click());
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

describe('scroll helpers', () => {
  it('scrollTopAfterPrepend keeps the same content in view', () => {
    expect(scrollTopAfterPrepend(10, 1000, 1500)).toBe(510);
    expect(scrollTopAfterPrepend(0, 800, 800)).toBe(0);
  });

  it('shouldAutoLoadOlder requires near-top, hasMore, handler and not loading', () => {
    const base = { scrollTop: 0, hasMore: true, loadingMore: false, hasHandler: true };
    expect(shouldAutoLoadOlder(base)).toBe(true);
    expect(shouldAutoLoadOlder({ ...base, scrollTop: AUTO_LOAD_TOP_PX })).toBe(true);
    expect(shouldAutoLoadOlder({ ...base, scrollTop: AUTO_LOAD_TOP_PX + 1 })).toBe(false);
    expect(shouldAutoLoadOlder({ ...base, hasMore: false })).toBe(false);
    expect(shouldAutoLoadOlder({ ...base, loadingMore: true })).toBe(false);
    expect(shouldAutoLoadOlder({ ...base, hasHandler: false })).toBe(false);
  });
});
