import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { CorrespondencePage } from '@/features/correspondence/CorrespondencePage';
import { projectsApi, type Project } from '@/features/projects/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';
import '../workspace.css';
import { registerMizitoSwitcher } from '../mizitoSwitcherBridge';
import { useSwitcherState } from '../hooks/useSwitcherState';
import { ProjectGroupSwitcherSidebar, usePinnedProjects } from './ProjectGroupSwitcherSidebar';

/**
 * «نامه‌ها» inside the Mizito shell. Same arrangement as the project page: Mizito top bar (chrome active),
 * the right-panel switcher with MizitoNav (desktop) and its hamburger drawer (mobile, via mizitoSwitcherBridge),
 * then the existing correspondence module unchanged (no new module, no new data).
 */
export function MizitoCorrespondencePage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams();
  const userId = useAuthStore((s) => s.userId) ?? '';
  const setChromeActive = useWorkspaceChromeStore((st) => st.setActive);
  const {
    open: switcherOpen,
    setOpen: setSwitcherOpen,
    desktopHidden,
    onMenuClick: onSwitcherMenuClick,
  } = useSwitcherState();

  useEffect(() => {
    // Mirror MizitoProjectWorkspace: hide OCE chrome and force light tokens while mounted.
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
      data-testid="mizito-letters"
      data-switcher-hidden={desktopHidden ? 'true' : undefined}
    >
      <ProjectGroupSwitcherSidebar
        projects={projects}
        activeProjectId={projectId}
        onSelectProject={selectProject}
        currentUserId={userId}
        mobileOpen={switcherOpen}
        onMobileClose={() => setSwitcherOpen(false)}
        pinnedProjectIds={pins.pinnedIds}
        onTogglePin={pins.togglePin}
        navActiveTo="/correspondence"
      />
      <main className="mz-main-canvas">
        <CorrespondencePage />
      </main>
    </div>
  );
}
