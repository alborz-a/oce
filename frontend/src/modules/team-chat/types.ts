// Team chat shared types (mirror backend/app/modules/team_chat/schemas.py).

export type RoomKind = 'company' | 'project' | 'group' | 'dm';

export interface ChatRoom {
  id: string;
  kind: RoomKind;
  name: string;
  project_id?: string | null;
  unread: number;
  last_message_at?: string | null;
  member_ids?: string[];
}

export interface ChatMessage {
  id: string;
  room_id: string;
  author_id?: string | null;
  author_name: string;
  text: string;
  reply_to_id?: string | null;
  document_ids: string[];
  created_at: string;
  edited_at?: string | null;
  metadata?: Record<string, unknown>;
}

export type ChatEvent =
  | { event: 'ready' }
  | { event: 'pong' }
  | { event: 'message.created'; message: ChatMessage }
  | { event: 'message.edited'; message: ChatMessage }
  | { event: 'room.read'; room_id: string };

export interface ProjectDocument {
  id: string;
  name: string;
}
