import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/api';

/** Palette from the Mizito design tokens. The first entry is the default colour. */
export const NOTE_COLORS = ['#fb0', '#1f5c88', '#0f9d58', '#db4437', '#4285f4', '#ff6839', '#039be5', '#607d8b'] as const;

export interface UserNote {
  id: string;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  title: string;
  body: string;
  color: string;
  pinned?: boolean;
}

export const notesApi = {
  list: () => apiGet<UserNote[]>('/v1/notes/'),
  create: (input: NoteInput) => apiPost<UserNote, NoteInput>('/v1/notes/', input),
  update: (id: string, input: Partial<NoteInput>) =>
    apiPatch<UserNote, Partial<NoteInput>>(`/v1/notes/${id}/`, input),
  remove: (id: string) => apiDelete<void>(`/v1/notes/${id}/`),
};
