// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Unread correspondence letters for the signed-in user (nav badge «نامه‌ها»).
 *
 * Counts letters in the caller's accessible projects, not sent by the caller,
 * with no read mark for the caller (`GET /v1/correspondence/unread-count/`).
 * Returns 0 while loading or on error.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';

export const LETTERS_UNREAD_COUNT_KEY = ['correspondence-unread-count'] as const;

interface UnreadCountResponse {
  count: number;
}

export function useLettersUnreadCount(): number {
  const { data } = useQuery({
    queryKey: LETTERS_UNREAD_COUNT_KEY,
    queryFn: () => apiGet<UnreadCountResponse>('/v1/correspondence/unread-count/'),
    enabled: !useAuthStore.getState().restrictedMode,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  return data?.count ?? 0;
}
