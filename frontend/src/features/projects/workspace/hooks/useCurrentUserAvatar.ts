import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';

/**
 * Logged-in user's photo URL from `/v1/users/me/` (`avatar_url`).
 * Same query key as the OCE header, so the request is shared, not repeated.
 */
export function useCurrentUserAvatar(): string | null {
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<{ avatar_url?: string | null }>('/v1/users/me/'),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const url = typeof data?.avatar_url === 'string' ? data.avatar_url.trim() : '';
  return url || null;
}
