import { lazy } from 'react';
import { StickyNote } from 'lucide-react';
import type { ModuleManifest } from '../_types';

/**
 * Personal notes (G1): each user's own note cards inside the Mizito shell.
 * Backend: `backend/app/modules/notes` (owner-scoped, `/api/v1/notes/`). Route `/notes` is open to normal users
 * via `frontend/src/app/normalUserRoutes.ts`.
 */
export const manifest: ModuleManifest = {
  id: 'notes',
  name: 'notes.title',
  description: 'notes.description',
  version: '0.1.0',
  icon: StickyNote,
  category: 'tools',
  defaultEnabled: true,
  routes: [{ path: '/notes', title: 'notes.title', component: lazy(() => import('./NotesModule')) }],
  navItems: [],
  translations: {
    fa: {
      'notes.title': 'یادداشت‌های من',
      'notes.description': 'یادداشت‌های شخصی هر کاربر با رنگ و سنجاق',
    },
    en: {
      'notes.title': 'My notes',
      'notes.description': 'Personal note cards with colour and pin',
    },
    de: {
      'notes.title': 'Meine Notizen',
      'notes.description': 'Persönliche Notizkarten mit Farbe und Pin',
    },
  },
};
