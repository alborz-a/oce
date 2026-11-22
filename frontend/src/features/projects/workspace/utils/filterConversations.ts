import type { ChatRoom, Colleague } from '@/modules/team-chat/types';

export type ConversationTab = 'all' | 'groups' | 'members';

export interface FilteredConversations {
  rooms: ChatRoom[];
  colleagues: Colleague[];
}

/** Unknown or missing `?tab=` value falls back to «همه». */
export function parseConversationTab(raw: string | null | undefined): ConversationTab {
  return raw === 'groups' || raw === 'members' ? raw : 'all';
}

/** Every room that is not a 1:1 direct message is a group conversation. */
export function isGroupRoom(room: ChatRoom): boolean {
  return room.kind !== 'dm';
}

/**
 * «همه» = groups + members, «گروه‌ها» = non-direct rooms only, «اعضا» = colleagues only.
 * The query matches room name for rooms, and full name or job title for colleagues (case-insensitive).
 */
export function filterConversations(
  tab: ConversationTab,
  query: string,
  rooms: ChatRoom[],
  colleagues: Colleague[],
): FilteredConversations {
  const showGroups = tab !== 'members';
  const showMembers = tab !== 'groups';
  const q = query.trim().toLowerCase();
  const matches = (...fields: (string | null | undefined)[]) =>
    !q || fields.some((f) => (f || '').toLowerCase().includes(q));

  return {
    rooms: showGroups ? rooms.filter((r) => isGroupRoom(r) && matches(r.name)) : [],
    colleagues: showMembers ? colleagues.filter((c) => matches(c.full_name, c.job_title)) : [],
  };
}
