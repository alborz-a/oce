import { useCallback } from 'react';
import { apiPost } from '@/shared/lib/api';
import type { ChatRoom } from '@/modules/team-chat/types';

/**
 * Returns `openDm(otherUserId)`: get-or-creates the 1:1 DM room between the
 * signed-in user and a colleague.
 *
 * - With `onOpenRoom` (inside the Mizito workspace): hands the room to the
 *   workspace, which shows the DM inside its own shell. No navigation.
 * - Without it (legacy project view, TeamStrip): opens `/chat/:roomId` via
 *   history push + popstate.
 *
 * The backend DM rule needs exactly two members and the caller must be one of
 * them, so `member_ids` is `[currentUserId, otherUserId]`.
 * Clicking yourself is a no-op.
 */
export function useOpenColleagueDm(
  currentUserId: string | null | undefined,
  onOpenRoom?: (room: ChatRoom, otherUserId: string) => void,
) {
  return useCallback(
    async (otherUserId: string) => {
      if (!currentUserId || !otherUserId || otherUserId === currentUserId) return;
      const room = await apiPost<ChatRoom>('/v1/team-chat/rooms/', {
        kind: 'dm',
        member_ids: [currentUserId, otherUserId],
      });
      if (onOpenRoom) {
        onOpenRoom(room, otherUserId);
        return;
      }
      // Router-agnostic navigation: history push + popstate makes the app router
      // (BrowserRouter / data router) re-read the location without a remount hook.
      window.history.pushState({}, '', `/chat/${room.id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    [currentUserId, onOpenRoom],
  );
}
