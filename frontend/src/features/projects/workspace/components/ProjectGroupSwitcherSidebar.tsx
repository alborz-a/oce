import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MzIcon } from './MzIcon';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import type { Project } from '@/features/projects/api';
import { useVisibleMembers } from '@/shared/lib/hiddenUsers';
import { toPersianDigits } from '@/shared/lib/jalali';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { useGlobalPresenceStore } from '@/stores/useGlobalPresenceStore';
import { isTopicConversationTask } from '../hooks/useProjectWorkspaceStats';
import { useOpenDmForColleague } from '../context/WorkspaceDmContext';
import { MizitoNav } from './MizitoNav';
import { useMyTaskCounts } from '../hooks/useMyTaskCounts';
import { useLettersUnreadCount } from '../hooks/useLettersUnreadCount';
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
  onOpenCompanyChat?: () => void;
  className?: string;
  /** Forwarded to MizitoNav: the single nav item to highlight (e.g. `/correspondence`). */
  navActiveTo?: string;
}


export function ProjectGroupSwitcherSidebar({
  currentUserId,
  members = [],
  tasks = [],
  teammateTaskMap,
  mobileOpen = false,
  onMobileClose,
  onOpenCompanyChat,
  className = '',
  navActiveTo,
  projects,
}: ProjectGroupSwitcherSidebarProps) {
  const openDm = useOpenDmForColleague(currentUserId);
  const myTaskCounts = useMyTaskCounts();
  const lettersUnread = useLettersUnreadCount();

  const visibleMembers = useVisibleMembers(members);

  // «ارسال پیام شخصی» colleague picker (⊕ in همکارانم header)
  const [dmPickerOpen, setDmPickerOpen] = useState(false);
  const [dmQuery, setDmQuery] = useState('');
  const dmTriggerRef = useRef<HTMLButtonElement>(null);
  const dmPopoverRef = useRef<HTMLDivElement>(null);
  useAnchoredPopover(dmTriggerRef, dmPopoverRef, dmPickerOpen);

  useEffect(() => {
    if (!dmPickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dmPopoverRef.current?.contains(target) || dmTriggerRef.current?.contains(target)) return;
      setDmPickerOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDmPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dmPickerOpen]);

  const dmPickerMembers = useMemo(() => {
    const q = dmQuery.trim().toLowerCase();
    return visibleMembers.filter((m) => {
      if (currentUserId && m.user_id === currentUserId) return false;
      if (!q) return true;
      return `${m.full_name ?? ''} ${m.email ?? ''}`.toLowerCase().includes(q);
    });
  }, [visibleMembers, currentUserId, dmQuery]);
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
            <MzIcon name="close" size={16} />
          </button>
        </div>

        <MizitoNav
          onOpenCompanyChat={onOpenCompanyChat}
          activeTo={navActiveTo}
          counts={{
            taskOverdue: myTaskCounts.overdue,
            taskOpen: myTaskCounts.open,
            projects: projects?.length ?? 0,
            letters: lettersUnread,
          }}
        />
        {/* Bottom `همکارانم` section */}
        <section
          aria-label="همکارانم"
          className="flex max-h-[42%] min-h-[150px] flex-col border-t border-[#e5e7eb] bg-white"
          data-testid="switcher-colleagues-section"
        >
          <div className="mz-colleague-header shrink-0">
            <span className="flex items-center gap-1.5">
              <MzIcon name="group" size={13} />
              <span>همکارانم</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-[11px] font-normal opacity-85 tabular-nums">
                {toPersianDigits(visibleMembers.length)}
              </span>
              <button
                ref={dmTriggerRef}
                type="button"
                aria-label="ارسال پیام شخصی"
                title="ارسال پیام شخصی"
                aria-haspopup="dialog"
                aria-expanded={dmPickerOpen}
                data-testid="switcher-new-dm-trigger"
                onClick={() => {
                  setDmQuery('');
                  setDmPickerOpen((v) => !v);
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-md hover:bg-[#f2f4f7]"
              >
                <MzIcon name="add_circle_outline" size={15} />
              </button>
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

      {dmPickerOpen &&
        createPortal(
          <div
            ref={dmPopoverRef}
            role="dialog"
            aria-label="ارسال پیام شخصی"
            data-testid="switcher-new-dm-picker"
            className="fixed z-[1000] w-64 rounded-lg border border-[#e5e7eb] bg-white p-2 shadow-lg"
          >
            <div className="mb-1.5 text-[12px] font-semibold text-[#1f2937]">ارسال پیام شخصی</div>
            <input
              type="search"
              value={dmQuery}
              onChange={(e) => setDmQuery(e.target.value)}
              placeholder="نام کاربر را وارد نمایید"
              aria-label="نام کاربر را وارد نمایید"
              data-testid="switcher-new-dm-search"
              className="mb-1.5 h-7 w-full rounded-md border border-[#e5e7eb] bg-[#f5f6f8] px-2 text-[12px] text-[#1f2937] placeholder:text-[#909090] focus:border-mz-project focus:outline-none"
            />
            <ul className="max-h-60 space-y-0.5 overflow-y-auto">
              {dmPickerMembers.map((member) => {
                const displayName = member.full_name || member.email;
                return (
                  <li key={member.user_id}>
                    <button
                      type="button"
                      data-testid={`switcher-new-dm-option-${member.user_id}`}
                      onClick={() => {
                        setDmPickerOpen(false);
                        void openDm(member.user_id);
                      }}
                      className="flex w-full items-center rounded-md px-1.5 py-1 text-start text-[12px] text-[#1f2937] hover:bg-[#f5f6f8]"
                    >
                      <span className="truncate">{displayName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {dmPickerMembers.length === 0 && (
              <p className="py-2 text-center text-[11px] text-[#909090]">کاربری یافت نشد</p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
