import { lazy } from 'react';
import { Users } from 'lucide-react';
import type { ModuleManifest } from '../_types';

/**
 * Customer file (G2): read-only list of CRM accounts inside the Mizito shell.
 * Data: `GET /api/v1/crm/accounts/` (crm.read). Route `/customers` is open to normal users via
 * `frontend/src/app/normalUserRoutes.ts`.
 */
export const manifest: ModuleManifest = {
  id: 'customers',
  name: 'customers.title',
  description: 'customers.description',
  version: '0.1.0',
  icon: Users,
  category: 'tools',
  defaultEnabled: true,
  routes: [{ path: '/customers', title: 'customers.title', component: lazy(() => import('./CustomersModule')) }],
  navItems: [],
  translations: {
    fa: {
      'customers.title': 'پرونده مشتریان',
      'customers.description': 'فهرست حساب‌های مشتری با جستجو و نمای فقط‌خواندنی',
    },
    en: {
      'customers.title': 'Customer file',
      'customers.description': 'Customer account list with search and read-only detail',
    },
    de: {
      'customers.title': 'Kundenakte',
      'customers.description': 'Kundenkontoliste mit Suche und schreibgeschützter Detailansicht',
    },
  },
};
