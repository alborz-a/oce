import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { projectsApi, type Project } from '@/features/projects/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';
import '../workspace.css';
import { registerMizitoSwitcher } from '../mizitoSwitcherBridge';
import { useSwitcherState } from '../hooks/useSwitcherState';
import { ProjectGroupSwitcherSidebar, usePinnedProjects } from './ProjectGroupSwitcherSidebar';

/**
 * «پروفایل» (profile and change-password) inside the Mizito shell. Same arrangement as MizitoCorrespondencePage:
 * Mizito top bar (chrome active), the project switcher with MizitoNav, then the existing ProfilePage unchanged.
 */
export function MizitoProfilePage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId) ?? '';
  const setChromeActive = useWorkspaceChromeStore((st) => st.setActive);
  const {
    open: switcherOpen,
    setOpen: setSwitcherOpen,
    desktopHidden,
    onMenuClick: onSwitcherMenuClick,
  } = useSwitcherState();

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

  const projectsQuery = useQuery({
    queryKey: ['projects', 'workspace-switcher'],
    queryFn: () => projectsApi.list(),
  });
  const projects: Project[] = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const pins = usePinnedProjects(userId, projects);

  const selectProject = useCallback(
    (id: string) => {
      setSwitcherOpen(false);
      navigate(`/projects/${id}`);
    },
    [navigate],
  );

  return (
    <div
      className="mizito-workspace-light mz-shell font-mz"
      dir="rtl"
      data-testid="mizito-profile"
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
        navActiveTo="/profile"
      />
      <main className="mz-main-canvas">
        <ProfilePage />
      </main>
    </div>
  );
}
