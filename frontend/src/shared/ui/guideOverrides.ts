// Editable guides: per module / role / user visibility and text, stored on the backend
// (oe_guide_override). The system admin edits; everyone else only reads the resolved result.

import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPut, apiDelete } from '@/shared/lib/api';
import { isAdminOnlyRoute } from '@/app/adminRoutes';
import { isRestrictedRouteAllowed } from '@/app/restrictedRoutes';
import type { ModuleGuideContent } from './ModuleGuide';

export interface GuideTextOverride {
  title?: string | null;
  intro?: string | null;
  sections: { title: string; body: string }[];
}

export interface ResolvedGuide {
  visible: boolean;
  content: GuideTextOverride | null;
}

export interface GuideOverrideRow {
  id: string;
  module_key: string;
  scope: 'global' | 'role' | 'user';
  scope_value: string;
  visible: boolean | null;
  content: GuideTextOverride | null;
}

const BASE = '/v1/guide-overrides';

export function useResolvedGuides() {
  return useQuery({
    queryKey: ['guide-overrides', 'resolved'],
    queryFn: () => apiGet<Record<string, ResolvedGuide>>(`${BASE}/`),
    staleTime: 5 * 60 * 1000,
  });
}

export const guideOverridesApi = {
  list: () => apiGet<GuideOverrideRow[]>(`${BASE}/admin/`),
  save: (body: {
    module_key: string;
    scope: 'global' | 'role' | 'user';
    scope_value: string;
    visible: boolean | null;
    content: GuideTextOverride | null;
  }) => apiPut<GuideOverrideRow>(`${BASE}/admin/`, body),
  remove: (id: string) => apiDelete(`${BASE}/admin/${id}/`),
};

/** First real path segment, skipping /projects/:id (so /projects/x/tasks is "tasks"). */
export function moduleKeyFromPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'projects' && parts.length >= 3) return parts[2] ?? 'projects';
  return parts[0] ?? 'home';
}

/** Drop markdown links [label](/path) whose page the viewer cannot open; keep the label. */
export function stripInaccessibleLinks(
  text: string,
  opts: { isAdmin: boolean; restricted: boolean },
): string {
  return text.replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, (_m, label: string, path: string) => {
    const blocked =
      (!opts.isAdmin && isAdminOnlyRoute(path)) || (opts.restricted && !isRestrictedRouteAllowed(path));
    return blocked ? label : `[${label}](${path})`;
  });
}

/** Overlay admin text on the built-in guide. Keys are made unique so i18n falls back to the text. */
export function applyGuideOverride(
  base: ModuleGuideContent,
  moduleKey: string,
  override: GuideTextOverride | null | undefined,
  linkOpts: { isAdmin: boolean; restricted: boolean },
): ModuleGuideContent {
  if (!override) return base;
  const clean = (s: string) => stripInaccessibleLinks(s, linkOpts);
  const next: ModuleGuideContent = { ...base };
  if (override.title) {
    next.titleKey = `guide.custom.${moduleKey}.title`;
    next.titleDefault = clean(override.title);
  }
  if (override.intro) {
    next.introKey = `guide.custom.${moduleKey}.intro`;
    next.introDefault = clean(override.intro);
  }
  next.sections = base.sections.map((s, i) => {
    const o = override.sections[i];
    if (!o) return s;
    return {
      ...s,
      titleKey: o.title ? `guide.custom.${moduleKey}.s${i}.title` : s.titleKey,
      titleDefault: o.title ? clean(o.title) : s.titleDefault,
      bodyKey: o.body ? `guide.custom.${moduleKey}.s${i}.body` : s.bodyKey,
      bodyDefault: o.body ? clean(o.body) : s.bodyDefault,
    };
  });
  return next;
}
