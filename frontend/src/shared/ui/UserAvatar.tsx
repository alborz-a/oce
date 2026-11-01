import { useEffect, useState, type ReactNode } from 'react';
import { fetchWithAuth } from '@/shared/lib/api';

export function NeutralAvatarPlaceholder({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? 'h-full w-full p-1 text-current opacity-85'}
      aria-hidden="true"
      data-testid="neutral-avatar-placeholder"
    >
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

interface UserAvatarProps {
  /** `avatar_url` from the user record, or null/undefined when no picture is set. */
  url: string | null | undefined;
  /**
   * Shown when there is no picture or it cannot be loaded.
   * Falls back to a neutral silhouette placeholder (never letter initials).
   */
  fallback?: ReactNode;
  alt: string;
  className?: string;
}

/**
 * Profile picture. The avatar route needs the bearer token, so a plain
 * `<img src>` cannot load it; the bytes are fetched with auth and shown from
 * an object URL. The URL carries a `?v=` stamp, so a new picture refetches.
 *
 * When no picture is available, renders a neutral silhouette avatar placeholder (never a letter initial).
 */
export function UserAvatar({ url, alt, className }: UserAvatarProps) {
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

  if (!url || !src) {
    return <NeutralAvatarPlaceholder className="h-full w-full p-1 text-current opacity-85" />;
  }
  return <img src={src} alt={alt} className={className ?? 'h-full w-full rounded-[inherit] object-cover'} />;
}
