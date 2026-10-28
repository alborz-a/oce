import { useEffect, useState, type ReactNode } from 'react';
import { fetchWithAuth } from '@/shared/lib/api';

interface UserAvatarProps {
  /** `avatar_url` from the user record, or null/undefined when no picture is set. */
  url: string | null | undefined;
  /** Shown when there is no picture or it cannot be loaded (the initials badge). */
  fallback: ReactNode;
  alt: string;
  className?: string;
}

/**
 * Profile picture. The avatar route needs the bearer token, so a plain
 * `<img src>` cannot load it; the bytes are fetched with auth and shown from
 * an object URL. The URL carries a `?v=` stamp, so a new picture refetches.
 */
export function UserAvatar({ url, fallback, alt, className }: UserAvatarProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchWithAuth(url)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!url || !src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className ?? 'h-full w-full rounded-[inherit] object-cover'} />;
}
