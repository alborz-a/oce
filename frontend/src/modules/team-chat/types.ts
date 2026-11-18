// Team chat shared types (mirror backend/app/modules/team_chat/schemas.py).

export type RoomKind = 'company' | 'project' | 'group' | 'dm' | 'channel';

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
  author_title?: string | null;
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
  | { event: 'message.deleted'; message_id: string }
  | { event: 'room.read'; room_id: string };

export interface Colleague {
  id: string;
  full_name: string;
  job_title?: string | null;
}

export interface ProjectDocument {
  id: string;
  name: string;
}
