import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi, type Project } from '@/features/projects/api';
import { apiGet } from '@/shared/lib/api';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';
import type { ChatRoom, Colleague } from '@/modules/team-chat/types';
import '../workspace.css';
import { registerMizitoSwitcher } from '../mizitoSwitcherBridge';
import { useSwitcherState } from '../hooks/useSwitcherState';
import { useOpenColleagueDm } from '../hooks/useOpenColleagueDm';
import { ProjectGroupSwitcherSidebar, usePinnedProjects } from './ProjectGroupSwitcherSidebar';

/**
 * «همکارانم» inside the Mizito shell. Same arrangement as the correspondence page: Mizito top bar (chrome active),
 * the right-panel switcher with MizitoNav, then the colleague list. A click opens the 1:1 DM in the shell:
 * the DM room is handed to the project workspace route (router state) and shown there with the nav kept.
 */
export function MizitoColleaguesPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId) ?? '';
  const setChromeActive = useWorkspaceChromeStore((st) => st.setActive);
  const {
    open: switcherOpen,
    setOpen: setSwitcherOpen,
    desktopHidden,
    onMenuClick: onSwitcherMenuClick,
  } = useSwitcherState();
  const [search, setSearch] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ['projects', 'workspace-switcher'],
    queryFn: () => projectsApi.list(),
  });
  const projects: Project[] = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const pins = usePinnedProjects(userId, projects);

  const colleaguesQuery = useQuery({
    queryKey: ['team-chat', 'colleagues'],
    queryFn: () => apiGet<Colleague[]>('/v1/team-chat/colleagues/'),
  });
  const colleagues: Colleague[] = useMemo(() => colleaguesQuery.data ?? [], [colleaguesQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return colleagues;
    return colleagues.filter(
      (c) => (c.full_name || '').toLowerCase().includes(q) || (c.job_title || '').toLowerCase().includes(q),
    );
  }, [colleagues, search]);

  const onOpenRoom = useCallback(
    (room: ChatRoom, otherUserId: string) => {
      const peer = colleagues.find((c) => c.id === otherUserId);
      const projectId = projects[0]?.id;
      if (!projectId) {
        setDmError('برای باز کردن گفتگو حداقل یک پروژه لازم است.');
        return;
      }
      setSwitcherOpen(false);
      navigate(`/projects/${projectId}`, {
        state: {
          dm: {
            room,
            peerName: peer?.full_name || 'همکار',
            peerAvatarUrl: peer?.avatar_url ?? null,
          },
        },
      });
    },
    [colleagues, projects, navigate, setSwitcherOpen],
  );
  const openDm = useOpenColleagueDm(userId, onOpenRoom);

  const handleOpenDm = useCallback(
    (colleagueId: string) => {
      setDmError(null);
      openDm(colleagueId).catch(() => setDmError('باز کردن گفتگو انجام نشد. دوباره تلاش کنید.'));
    },
    [openDm],
  );

  const selectProject = useCallback(
    (id: string) => {
      setSwitcherOpen(false);
      navigate(`/projects/${id}`);
    },
    [navigate, setSwitcherOpen],
  );

  useEffect(() => {
    // Mirror MizitoCorrespondencePage: hide OCE chrome and force light tokens while mounted.
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    root.classList.add('mizito-light-root');
    setChromeActive(true);
    return () => {
      root.classList.remove('mizito-light-root');
      if (hadDark) root.classList.add('dark');
      setChromeActive(false);
    };
  }, [setChromeActive]);

  useEffect(() => registerMizitoSwitcher(onSwitcherMenuClick), [onSwitcherMenuClick]);

  return (
    <div
      className="mizito-workspace-light mz-shell font-mz"
      dir="rtl"
      data-testid="mizito-colleagues"
      data-switcher-hidden={desktopHidden ? 'true' : undefined}
    >
      <ProjectGroupSwitcherSidebar
        projects={projects}
        activeProjectId=""
        onSelectProject={selectProject}
        currentUserId={userId}
        mobileOpen={switcherOpen}
        onMobileClose={() => setSwitcherOpen(false)}
        pinnedProjectIds={pins.pinnedIds}
        onTogglePin={pins.togglePin}
        navActiveTo="/colleagues"
      />
      <main className="mz-main-canvas">
        <section className="flex h-full flex-col gap-3 p-4" data-testid="colleagues-page">
          <h1 className="text-lg font-semibold text-[#263648]">همکارانم</h1>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام یا سمت"
            className="w-full rounded border border-[#e5eaf0] px-3 py-2 text-sm"
            data-testid="colleagues-search"
          />
          {dmError && (
            <p className="text-sm text-red-600" role="alert" data-testid="colleagues-dm-error">
              {dmError}
            </p>
          )}
          {colleaguesQuery.isLoading && <p className="text-sm text-[var(--mz-muted)]">در حال بارگذاری…</p>}
          {colleaguesQuery.isError && (
            <p className="text-sm text-red-600" role="alert" data-testid="colleagues-error">
              خطا در بارگذاری همکاران.
            </p>
          )}
          {!colleaguesQuery.isLoading && !colleaguesQuery.isError && filtered.length === 0 && (
            <p className="text-sm text-[var(--mz-muted)]" data-testid="colleagues-empty">
              همکاری پیدا نشد.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-[#e5eaf0] overflow-y-auto" data-testid="colleagues-list">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleOpenDm(c.id)}
                  className="flex w-full items-center gap-3 px-2 py-2 text-right"
                  data-testid="colleague-row"
                >
                  <UserAvatar url={c.avatar_url} alt={c.full_name} className="h-10 w-10 shrink-0 rounded-full" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-[#263648]">{c.full_name}</span>
                    {c.job_title && (
                      <span className="truncate text-xs text-[var(--mz-colleague-title)]" data-testid="colleague-job-title">
                        {c.job_title}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
