import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, Star, Users, X } from 'lucide-react';
import type { Project } from '@/features/projects/api';
import { useVisibleMembers } from '@/shared/lib/hiddenUsers';
import { toPersianDigits } from '@/shared/lib/jalali';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { useGlobalPresenceStore } from '@/stores/useGlobalPresenceStore';
import { isTopicConversationTask } from '../hooks/useProjectWorkspaceStats';
import { useOpenColleagueDm } from '../hooks/useOpenColleagueDm';
import type { ProjectSwitcherCategory, ProjectTaskItem, WorkspaceMember } from '../types';

const DEFAULT_PINNED_PROJECT_NAME = 'پیگیری اداری';

export function getPinnedStorageKey(userId: string | null | undefined): string {
  return `mz_pinned_projects_v1_${userId || 'anon'}`;
}

export function isAdminOrGeneralProject(project: Pick<Project, 'name' | 'project_type' | 'metadata'>): boolean {
  const meta = project.metadata ?? {};
  if (
    meta.is_group === true ||
    meta.is_admin_group === true ||
    meta.mizito_group === true ||
    meta.mizito_type === 'group' ||
    meta.group_type === 'general' ||
    meta.category === 'admin_general'
  ) {
    return true;
  }
  const pType = (project.project_type ?? '').trim().toLowerCase();
  if (pType === 'admin' || pType === 'general' || pType === 'group') {
    return true;
  }
  const name = (project.name ?? '').trim();
  return (
    name.includes(DEFAULT_PINNED_PROJECT_NAME) ||
    name.includes('گروه اداری') ||
    name.includes('عمومی')
  );
}

export function classifyProjectGroup(
  project: Project,
  pinnedSet: ReadonlySet<string>,
): ProjectSwitcherCategory {
  if (pinnedSet.has(project.id)) return 'pinned';
  if ((project.status ?? '').trim().toLowerCase() === 'archived') return 'archived';
  if (isAdminOrGeneralProject(project)) return 'admin_general';
  return 'active';
}

function readStoredPins(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return null;
  }
}

function writeStoredPins(key: string, ids: readonly string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Ignore storage quota or private-mode failures gracefully
  }
}

export function usePinnedProjects(
  currentUserId: string | null | undefined,
  projects: readonly Project[],
): {
  pinnedIds: string[];
  togglePin: (projectId: string) => void;
} {
  const storageKey = getPinnedStorageKey(currentUserId);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    const stored = typeof window !== 'undefined' ? readStoredPins(storageKey) : null;
    return stored ?? [];
  });
  const [initialized, setInitialized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return readStoredPins(storageKey) !== null;
  });

  // Re-sync when user switches account
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredPins(storageKey);
    if (stored !== null) {
      setPinnedIds(stored);
      setInitialized(true);
    } else {
      setPinnedIds([]);
      setInitialized(false);
    }
  }, [storageKey]);

  // Seed default pin (`پیگیری اداری`) once on first load when no user pref exists yet
  useEffect(() => {
    if (initialized || projects.length === 0) return;
    const defaults = projects
      .filter((p) => (p.name ?? '').includes(DEFAULT_PINNED_PROJECT_NAME))
      .map((p) => p.id);
    if (defaults.length > 0) {
      setPinnedIds(defaults);
      writeStoredPins(storageKey, defaults);
      setInitialized(true);
    }
  }, [initialized, projects, storageKey]);

  const togglePin = useCallback(
    (projectId: string) => {
      setPinnedIds((prev) => {
        const exists = prev.includes(projectId);
        const next = exists ? prev.filter((id) => id !== projectId) : [projectId, ...prev];
        writeStoredPins(storageKey, next);
        setInitialized(true);
        return next;
      });
    },
    [storageKey],
  );

  return { pinnedIds, togglePin };
}

function monogramForProject(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'پ';
  if (words.length === 1) return words[0]!.slice(0, 2);
  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`;
}

function swatchForProject(id: string): string {
  const palette = ['#3078ab', '#6ab04c', '#ba68c8', '#00b4d8', '#ff8c7e', '#4b9fff'];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length] ?? '#3078ab';
}

export interface ProjectGroupSwitcherSidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  currentUserId?: string | null;
  members?: WorkspaceMember[];
  tasks?: readonly ProjectTaskItem[];
  teammateTaskMap?: Record<string, string>;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  pinnedProjectIds?: string[];
  onTogglePin?: (projectId: string) => void;
  className?: string;
}

interface SectionConfig {
  key: ProjectSwitcherCategory;
  title: string;
  defaultOpen: boolean;
}

const SECTIONS: readonly SectionConfig[] = [
  { key: 'pinned', title: 'پین‌شده‌ها', defaultOpen: true },
  { key: 'active', title: 'پروژه‌های فعال', defaultOpen: true },
  { key: 'admin_general', title: 'گروه‌های اداری و عمومی', defaultOpen: true },
  { key: 'archived', title: 'بایگانی‌شده', defaultOpen: false },
];

export function ProjectGroupSwitcherSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  currentUserId,
  members = [],
  tasks = [],
  teammateTaskMap,
  mobileOpen = false,
  onMobileClose,
  pinnedProjectIds,
  onTogglePin,
  className = '',
}: ProjectGroupSwitcherSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const localPins = usePinnedProjects(currentUserId, projects);
  const openDm = useOpenColleagueDm(currentUserId);
  const effectivePinnedIds = pinnedProjectIds ?? localPins.pinnedIds;
  const effectiveTogglePin = onTogglePin ?? localPins.togglePin;

  const pinnedSet = useMemo(() => new Set(effectivePinnedIds), [effectivePinnedIds]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const nameMatch = (p.name ?? '').toLowerCase().includes(q);
      const codeMatch = (p.project_type ?? '').toLowerCase().includes(q);
      return nameMatch || codeMatch;
    });
  }, [projects, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<ProjectSwitcherCategory, Project[]> = {
      pinned: [],
      active: [],
      admin_general: [],
      archived: [],
    };
    for (const p of filteredProjects) {
      map[classifyProjectGroup(p, pinnedSet)].push(p);
    }
    return map;
  }, [filteredProjects, pinnedSet]);

  const visibleMembers = useVisibleMembers(members);
  const presenceUsers = useGlobalPresenceStore((s) => s.users);

  const derivedTasksByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (isTopicConversationTask(task)) continue;
      const uid = task.responsible_id;
      if (!uid) continue;
      const statusLower = (task.status ?? '').trim().toLowerCase();
      if (statusLower === 'done' || statusLower === 'completed') continue;
      if (!map.has(uid) || statusLower === 'in_progress') {
        map.set(uid, task.title);
      }
    }
    return map;
  }, [tasks]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      <div
        className="mz-drawer-backdrop"
        data-open={mobileOpen ? 'true' : 'false'}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={`mz-switcher-col ${className}`}
        data-open={mobileOpen ? 'true' : 'false'}
        aria-label="سوییچر پروژه‌ها و همکاران"
        data-testid="project-group-switcher"
      >
        {/* Mobile drawer header */}
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2 lg:hidden">
          <span className="text-[12.5px] font-semibold text-[#1f2937]">گروه‌ها و پروژه‌ها</span>
          <button
            type="button"
            onClick={onMobileClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f2f4f7] hover:text-[#1f2937]"
            aria-label="بستن منوی پروژه‌ها"
          >
            <X size={16} />
          </button>
        </div>

        {/* Native <search> landmark */}
        <search className="border-b border-[#e5e7eb] px-2.5 py-2">
          <div className="relative flex items-center">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute start-2.5 text-[#909090]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی پروژه یا گروه..."
              aria-label="جستجوی پروژه یا گروه"
              data-testid="switcher-search-input"
              className="h-8 w-full rounded-md border border-[#e5e7eb] bg-[#f5f6f8] ps-8 pe-7 text-[12px] text-[#1f2937] placeholder:text-[#909090] focus:border-mz-project focus:bg-white focus:outline-none"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="پاک کردن جستجو"
                className="absolute end-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-[#909090] hover:text-[#1f2937]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </search>

        {/* Scrollable project/group sections */}
        <div className="mz-scroll-area flex-1 px-1.5 py-2 space-y-1.5">
          {filteredProjects.length === 0 ? (
            <p className="px-2 py-4 text-center text-[12px] text-[#909090]">
              پروژه یا گروهی یافت نشد
            </p>
          ) : (
            SECTIONS.map((section) => {
              const items = grouped[section.key];
              if (items.length === 0 && section.key !== 'pinned') return null;
              if (items.length === 0 && section.key === 'pinned' && isSearching) return null;

              const openAttr = isSearching ? items.length > 0 : section.defaultOpen;

              return (
                <details
                  key={section.key}
                  className="mz-group-details"
                  open={openAttr}
                  data-testid={`switcher-section-${section.key}`}
                >
                  <summary className="flex items-center justify-between rounded px-2 py-1 text-[11.5px] font-semibold text-[#5b5e66] hover:bg-[#f5f6f8]">
                    <span className="flex items-center gap-1.5">
                      <ChevronDown
                        size={13}
                        aria-hidden="true"
                        className="mz-chevron-indicator text-[#909090]"
                      />
                      <span>{section.title}</span>
                    </span>
                    <span className="rounded-full bg-[#f2f4f7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#6b7280] tabular-nums">
                      {toPersianDigits(items.length)}
                    </span>
                  </summary>

                  {items.length === 0 ? (
                    <p className="px-3 py-1.5 text-[11px] text-[#909090]">
                      موردی پین نشده است
                    </p>
                  ) : (
                    <ul className="mt-0.5 space-y-0.5">
                      {items.map((project) => {
                        const isActive = project.id === activeProjectId;
                        const isPinned = pinnedSet.has(project.id);
                        return (
                          <li
                            key={project.id}
                            className={`group flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors ${
                              isActive
                                ? 'bg-[#e8f2fa] text-mz-project'
                                : 'text-[#374151] hover:bg-[#f5f6f8]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectProject(project.id);
                                onMobileClose?.();
                              }}
                              aria-current={isActive ? 'page' : undefined}
                              data-testid={`switcher-project-${project.id}`}
                              className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-mz-project"
                            >
                              <span
                                aria-hidden="true"
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white"
                                style={{ backgroundColor: swatchForProject(project.id) }}
                              >
                                {monogramForProject(project.name)}
                              </span>
                              <span
                                className={`min-w-0 flex-1 truncate text-[12px] ${
                                  isActive ? 'font-semibold text-mz-project' : 'font-medium'
                                }`}
                              >
                                {toPersianDigits(project.name)}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => effectiveTogglePin(project.id)}
                              aria-pressed={isPinned}
                              aria-label={
                                isPinned
                                  ? `برداشتن پین ${project.name}`
                                  : `پین کردن ${project.name}`
                              }
                              data-testid={`switcher-pin-${project.id}`}
                              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-mz-project ${
                                isPinned
                                  ? 'text-[#f59e0b] opacity-100'
                                  : 'text-[#9ca3af] opacity-0 group-hover:opacity-100 hover:text-[#f59e0b]'
                              }`}
                            >
                              <Star
                                size={13}
                                fill={isPinned ? 'currentColor' : 'none'}
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </details>
              );
            })
          )}
        </div>

        {/* Bottom `همکارانم` section */}
        <section
          aria-label="همکارانم"
          className="flex max-h-[42%] min-h-[150px] flex-col border-t border-[#e5e7eb] bg-white"
          data-testid="switcher-colleagues-section"
        >
          <div className="mz-colleague-header shrink-0">
            <span className="flex items-center gap-1.5">
              <Users size={13} aria-hidden="true" />
              <span>همکارانم</span>
            </span>
            <span className="text-[11px] font-normal opacity-85 tabular-nums">
              {toPersianDigits(visibleMembers.length)}
            </span>
          </div>

          <div className="mz-scroll-area flex-1 px-2 py-1.5">
            {visibleMembers.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-[#909090]">
                عضوی در این گروه ثبت نشده است
              </p>
            ) : (
              <ul className="space-y-1">
                {visibleMembers.map((member) => {
                  const isMe = Boolean(currentUserId && member.user_id === currentUserId);
                  const presence = presenceUsers[member.user_id];
                  const isOnline = presence?.status === 'active';
                  const currentTask =
                    teammateTaskMap?.[member.user_id] ??
                    derivedTasksByUser.get(member.user_id) ??
                    '';
                  const displayName = member.full_name || member.email;

                  return (
                    <li
                      key={member.user_id}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#f5f6f8]"
                      data-testid={`switcher-colleague-${member.user_id}`}
                      role={isMe ? undefined : 'button'}
                      tabIndex={isMe ? undefined : 0}
                      aria-label={isMe ? undefined : `گفتگوی مستقیم با ${displayName}`}
                      onClick={isMe ? undefined : () => void openDm(member.user_id)}
                      onKeyDown={
                        isMe
                          ? undefined
                          : (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void openDm(member.user_id);
                              }
                            }
                      }
                    >
                      <div className="relative h-7 w-7 shrink-0 rounded-full bg-[#e5e7eb] text-[#4b5563]">
                        <UserAvatar
                          url={member.avatar_url}
                          alt={displayName}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                        {isOnline && (
                          <span
                            aria-label="آنلاین"
                            className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#6ab04c]"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[12px] font-medium text-[#1f2937]">
                          <span className="truncate">{displayName}</span>
                          {isMe && (
                            <span className="shrink-0 text-[10.5px] text-mz-project">(من)</span>
                          )}
                        </div>
                        {currentTask ? (
                          <p className="truncate text-[10.5px] text-[#909090]">
                            {toPersianDigits(currentTask)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </aside>
    </>
  );
}
