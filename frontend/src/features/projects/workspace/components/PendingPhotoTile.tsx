import { useEffect, useRef, useState } from 'react';
import { apiGet } from '@/shared/lib/api';
import { MzIcon } from './MzIcon';

type PhotoUrlKind = 'thumb' | 'file';

interface PhotoUrlResponse {
  url?: string | null;
}

const MAX_CONCURRENT_URL_REQUESTS = 6;
const urlCache = new Map<string, Promise<string | null>>();
let activeRequests = 0;
const waitingRequests: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_URL_REQUESTS) {
    activeRequests += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitingRequests.push(() => {
      activeRequests += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests -= 1;
  const next = waitingRequests.shift();
  if (next) next();
}

/**
 * Presigned URL of one photo by id (`thumb` for the bubble, `file` for the full image).
 * In-memory cache by id; at most 6 requests in flight. Failed lookups are not cached.
 */
export function getPhotoUrl(photoId: string, kind: PhotoUrlKind): Promise<string | null> {
  const key = `${kind}:${photoId}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  const pending = (async (): Promise<string | null> => {
    await acquireSlot();
    try {
      const res = await apiGet<PhotoUrlResponse>(
        `/v1/documents/photos/${encodeURIComponent(photoId)}/${kind}-url/`,
      );
      return res?.url || null;
    } catch {
      return null;
    } finally {
      releaseSlot();
    }
  })().then((url) => {
    if (!url) urlCache.delete(key);
    return url;
  });

  urlCache.set(key, pending);
  return pending;
}

export interface PendingPhotoTileProps {
  photoId: string;
}

/**
 * Chat photo attachment that is not in the loaded photo list. Loads its thumbnail
 * by id when it scrolls into view. Shows a skeleton while loading and
 * «تصویر در دسترس نیست» on failure, never a blank bubble.
 */
export function PendingPhotoTile({ photoId }: PendingPhotoTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void getPhotoUrl(photoId, 'thumb').then((url) => {
      if (cancelled) return;
      if (url) setSrc(url);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, photoId]);

  const openFull = () => {
    void getPhotoUrl(photoId, 'file').then((url) => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  };

  return (
    <div
      ref={ref}
      className="im-entity-photo relative flex items-center justify-center bg-[#f2f4f7]"
      data-testid={`pending-photo-${photoId}`}
      onClick={src ? openFull : undefined}
    >
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-[#909090]">
          <MzIcon name="image" size={22} />
          <span>تصویر در دسترس نیست</span>
        </div>
      ) : src ? (
        <img
          src={src}
          alt="تصویر پروژه"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full animate-pulse items-center justify-center text-[#909090]">
          <MzIcon name="image" size={24} />
        </div>
      )}
    </div>
  );
}
