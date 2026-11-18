import { lazy } from 'react';
import { Activity } from 'lucide-react';
import type { ModuleManifest } from '../_types';

/**
 * Monitoring (G3): live colleague board inside the Mizito shell. Frontend only; presence comes from
 * `useGlobalPresenceStore`, the colleague list from the active project members. Route `/monitoring` is open to
 * normal users via `frontend/src/app/normalUserRoutes.ts`.
 */
export const manifest: ModuleManifest = {
  id: 'monitoring',
  name: 'monitoring.title',
  description: 'monitoring.description',
  version: '0.1.0',
  icon: Activity,
  category: 'tools',
  defaultEnabled: true,
  routes: [{ path: '/monitoring', title: 'monitoring.title', component: lazy(() => import('./MonitoringModule')) }],
  navItems: [],
  translations: {
    fa: {
      'monitoring.title': 'مانیتورینگ',
      'monitoring.description': 'وضعیت آنلاین همکاران، کار فعلی و آخرین فعالیت',
    },
    en: {
      'monitoring.title': 'Monitoring',
      'monitoring.description': 'Colleague online status, current task and last activity',
    },
    de: {
      'monitoring.title': 'Überwachung',
      'monitoring.description': 'Online-Status der Kollegen, aktuelle Aufgabe und letzte Aktivität',
    },
  },
};
