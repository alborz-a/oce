import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { projectsApi, type Project } from '@/features/projects/api';
import { apiGet } from '@/shared/lib/api';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';
import type { ChatRoom, Colleague } from '@/modules/team-chat/types';
import '../workspace.css';
import { registerMizitoSwitcher } from '../mizitoSwitcherBridge';
import { useSwitcherState } from '../hooks/useSwitcherState';
import { useCurrentUserAvatar } from '../hooks/useCurrentUserAvatar';
import { useOpenColleagueDm } from '../hooks/useOpenColleagueDm';
import { projectInitials } from '../utils/projectInitials';
import { ProjectGroupSwitcherSidebar, usePinnedProjects } from './ProjectGroupSwitcherSidebar';
import { ProjectGroupTab } from './ProjectGroupTab';
import type { ProjectMemberSummary } from './ProjectBoardTab';
import type { ProjectTaskItem } from '../types';
import { ConversationTabs } from './ConversationTabs';
import { filterConversations, parseConversationTab, type ConversationTab } from '../utils/filterConversations';

const NO_TASKS: ProjectTaskItem[] = [];
const NO_MEMBERS: ProjectMemberSummary[] = [];

/**
 * «همکارانم» inside the Mizito shell. Same arrangement as the correspondence page: Mizito top bar (chrome active),
 * the right-panel switcher with MizitoNav, then the colleague list. A click creates-or-opens the 1:1 DM and
 * navigates to `/colleagues/:roomId`, where the DM is shown in the main canvas (nav kept) with a DM header.
 */
export function MizitoColleaguesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams<{ roomId?: string }>();
  const userId = useAuthStore((s) => s.userId) ?? '';
  const userFullName = useAuthStore((s) => s.userFullName);
  const userEmail = useAuthStore((s) => s.userEmail);
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

  // Rooms list: feeds the «گروه‌ها» tab and resolves the open room, so a hard reload of /colleagues/:roomId also works.
  const roomsQuery = useQuery({
    queryKey: ['team-chat', 'colleague-rooms'],
    queryFn: () => apiGet<ChatRoom[]>('/v1/team-chat/rooms/'),
  });
  const openRoom: ChatRoom | null = useMemo(
    () => (roomId ? (roomsQuery.data ?? []).find((r) => r.id === roomId) ?? null : null),
    [roomId, roomsQuery.data],
  );
  const peerIdFromState = (location.state as { peerId?: string } | null)?.peerId ?? null;
  const peerId = openRoom?.member_ids?.find((id) => id !== userId) ?? peerIdFromState;
  const peer = useMemo(() => colleagues.find((c) => c.id === peerId) ?? null, [colleagues, peerId]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseConversationTab(searchParams.get('tab'));
  const setTab = useCallback(
    (next: ConversationTab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'all') params.delete('tab');
          else params.set('tab', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { rooms: visibleRooms, colleagues: filtered } = useMemo(
    () => filterConversations(tab, search, roomsQuery.data ?? [], colleagues),
    [tab, search, roomsQuery.data, colleagues],
  );

  const onOpenRoom = useCallback(
    (room: ChatRoom, otherUserId: string) => {
      setSwitcherOpen(false);
      navigate(`/colleagues/${room.id}`, { state: { peerId: otherUserId } });
    },
    [navigate, setSwitcherOpen],
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

  const currentUserAvatarUrl = useCurrentUserAvatar();
  const currentUser = useMemo(
    () => ({
      id: userId,
      full_name: userFullName ?? undefined,
      email: userEmail ?? undefined,
      avatar_url: currentUserAvatarUrl,
    }),
    [userId, userFullName, userEmail, currentUserAvatarUrl],
  );

  const renderDm = () => {
    if (roomsQuery.isError) {
      return (
        <p className="p-4 text-sm text-red-600" role="alert" data-testid="colleagues-dm-error">
          بارگذاری گفتگو ممکن نشد.
        </p>
      );
    }
    if (!openRoom) {
      return (
        <p className="p-4 text-sm text-[var(--mz-muted)]" data-testid="colleagues-dm-loading">
          {roomsQuery.isLoading ? 'در حال بارگذاری…' : 'گفتگو پیدا نشد.'}
        </p>
      );
    }
    return (
      <ProjectGroupTab
        projectId=""
        currentUserId={userId}
        currentUser={currentUser}
        tasks={NO_TASKS}
        members={NO_MEMBERS}
        showFilterBar={false}
        dm={{
          room: openRoom,
          peerName: openRoom.kind === 'dm' ? peer?.full_name || 'همکار' : openRoom.name,
          peerAvatarUrl: openRoom.kind === 'dm' ? (peer?.avatar_url ?? null) : null,
        }}
        onCloseDm={() => navigate('/colleagues')}
        dmBackLabel="بازگشت به همکارانم"
      />
    );
  };

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
        {roomId ? (
          <section className="flex h-full min-h-0 flex-col" data-testid="colleagues-dm">
            {renderDm()}
          </section>
        ) : (
          <section className="flex h-full flex-col gap-3 p-4" data-testid="colleagues-page">
            <h1 className="text-lg font-semibold text-[#263648]">همکارانم</h1>
            <ConversationTabs value={tab} onChange={setTab} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="فیلتر"
              aria-label="فیلتر"
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
            {!colleaguesQuery.isLoading && !colleaguesQuery.isError && filtered.length === 0 && visibleRooms.length === 0 && (
              <p className="text-sm text-[var(--mz-muted)]" data-testid="colleagues-empty">
                همکاری پیدا نشد.
              </p>
            )}
            {visibleRooms.length > 0 && (
              <ul className="flex flex-col divide-y divide-[#e5eaf0] overflow-y-auto" data-testid="conversations-groups-list">
                {visibleRooms.map((room) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/colleagues/${room.id}`)}
                      className="flex w-full items-center gap-3 px-2 py-2 text-right"
                      data-testid="conversation-group-row"
                    >
                      <span
                        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[var(--mz-appbar)] text-sm font-bold text-white"
                        aria-hidden="true"
                      >
                        {projectInitials(room.name)}
                      </span>
                      <span className="truncate text-sm font-bold text-[#263648]">{room.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
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
                    <div className="h-[40px] w-[40px] shrink-0 overflow-hidden rounded-full" data-testid="colleague-avatar">
                      <UserAvatar
                        url={c.avatar_url}
                        alt={c.full_name}
                        className="h-full w-full rounded-full object-cover"
                        fallback={
                          <span
                            className="flex h-full w-full items-center justify-center rounded-full bg-[var(--mz-appbar)] text-sm font-bold text-white"
                            aria-hidden="true"
                            data-testid="colleague-avatar-initials"
                          >
                            {projectInitials(c.full_name)}
                          </span>
                        }
                      />
                    </div>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-bold text-[#263648]">{c.full_name}</span>
                      {c.job_title && (
                        <span className="w-fit max-w-full truncate rounded-full bg-[#eef2f7] px-2 py-0.5 text-[11px] text-[var(--mz-colleague-title)]" data-testid="colleague-job-title">
                          {c.job_title}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
