/**
 * Contract client for the Mizito-style letters (کارتابل). Paths and shapes follow
 * /mnt/archive/rsd-reports/rsc/letters-spec.md (API contract section).
 */
import { API_BASE, apiDelete, apiGet, apiPost, fetchWithAuth } from '@/shared/lib/api';

export type MailboxBox = 'inbox' | 'outbox' | 'paraph' | 'archived';

export interface LetterRecipient {
  user_id: string;
  name: string;
}

/** Per-user label as returned by the backend (`LabelOut`: id and name only, no color). */
export interface LetterLabel {
  id: string;
  name: string;
}

export interface LetterListItem {
  id: string;
  thread_id: string;
  subject: string;
  snippet: string;
  sender_user_id: string;
  sender_name: string;
  sender_avatar_url: string | null;
  recipients: LetterRecipient[];
  sent_at: string;
  unread: boolean;
  attachments_count: number;
  direction: 'incoming' | 'outgoing';
  reference_number: string | null;
  /** Composed secretariat number, e.g. `ق- ۲۳۷ -۴۰۵`; null when not registered. */
  letter_number?: string | null;
  /** 1 = وارده, 2 = صادره; null when not registered. */
  register_type?: number | null;
  labels: LetterLabel[];
}

export type SecretariatPrefix = 'ق' | 'خ' | 'ص' | 'د' | 'ن' | 'الف';

export interface RegisterResponse {
  id: string;
  letter_number: string;
  register_type: number;
  secretariat_registered_at: string;
}

export interface MailboxResponse {
  items: LetterListItem[];
  total: number;
}

export interface MailboxFilters {
  label?: string;
  q?: string;
  unread?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface LetterAttachment {
  id: string;
  name: string;
  size: number;
  download_url: string;
}

export interface LetterMessage {
  id: string;
  sender_user_id: string;
  sender_name: string;
  sender_avatar_url: string | null;
  recipients: LetterRecipient[];
  body_html: string;
  sent_at: string;
  attachments: LetterAttachment[];
}

export interface LetterThread {
  subject: string;
  reference_number: string | null;
  letter_number?: string | null;
  register_type?: number | null;
  secretariat_registered_at?: string | null;
  letter_type: string | null;
  registered_at: string | null;
  labels: LetterLabel[];
  messages: LetterMessage[];
}

export interface ComposeBody {
  subject: string;
  body: string;
  to_user_ids: string[];
  label_ids: string[];
  project_id?: string;
}

export interface ComposeResponse {
  id: string;
  thread_id?: string;
}

export function buildMailboxQuery(box: MailboxBox, f: MailboxFilters = {}): string {
  const params = new URLSearchParams({ box });
  if (f.label) params.set('label', f.label);
  // URLSearchParams encodes values; label ids still pass through the same path as all other ids.
  if (f.q) params.set('q', f.q);
  if (f.unread) params.set('unread', 'true');
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  if (f.limit !== undefined) params.set('limit', String(f.limit));
  if (f.offset !== undefined) params.set('offset', String(f.offset));
  return `/v1/correspondence/mailbox/?${params.toString()}`;
}

/** Every id from the URL or state goes into a path through this; never raw. */
const seg = (id: string) => encodeURIComponent(id);

export const lettersApi = {
  mailbox: (box: MailboxBox, f?: MailboxFilters) => apiGet<MailboxResponse>(buildMailboxQuery(box, f)),
  unreadCount: () => apiGet<{ count: number }>('/v1/correspondence/mailbox/unread-count/'),
  thread: (id: string) => apiGet<LetterThread>(`/v1/correspondence/${seg(id)}/thread/`),
  compose: (body: ComposeBody) => apiPost<ComposeResponse, ComposeBody>('/v1/correspondence/compose/', body),
  reply: (id: string, body: string) =>
    apiPost<unknown, { body: string }>(`/v1/correspondence/${seg(id)}/reply/`, { body }),
  forward: (id: string, toUserIds: string[], note: string) =>
    apiPost<unknown, { to_user_ids: string[]; note: string }>(`/v1/correspondence/${seg(id)}/forward/`, {
      to_user_ids: toUserIds,
      note,
    }),
  register: (id: string, prefix: SecretariatPrefix) =>
    apiPost<RegisterResponse, { prefix: SecretariatPrefix }>(`/v1/correspondence/${seg(id)}/register/`, { prefix }),
  archive: (id: string) => apiPost<unknown>(`/v1/correspondence/${seg(id)}/archive/`),
  unarchive: (id: string) => apiPost<unknown>(`/v1/correspondence/${seg(id)}/unarchive/`),
  markRead: (id: string) => apiPost<unknown>(`/v1/correspondence/${seg(id)}/read/`),
  labels: () => apiGet<LetterLabel[]>('/v1/correspondence/labels/'),
  createLabel: (name: string) => apiPost<LetterLabel, { name: string }>('/v1/correspondence/labels/', { name }),
  attachLabel: (letterId: string, labelId: string) =>
    apiPost<unknown>(`/v1/correspondence/${seg(letterId)}/labels/${seg(labelId)}/`),
  detachLabel: (letterId: string, labelId: string) =>
    apiDelete<unknown>(`/v1/correspondence/${seg(letterId)}/labels/${seg(labelId)}/`),
  /** Multipart upload, one file per call. Raw fetch because the JSON helpers do not send FormData. */
  uploadAttachment: async (letterId: string, file: File): Promise<void> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetchWithAuth(`${API_BASE}/v1/correspondence/${seg(letterId)}/attachments/`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  },
};
