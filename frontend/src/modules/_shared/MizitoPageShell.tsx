import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsApi, type Project } from '@/features/projects/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';
import '@/features/projects/workspace/workspace.css';
import { registerMizitoSwitcher } from '@/features/projects/workspace/mizitoSwitcherBridge';
import { useSwitcherState } from '@/features/projects/workspace/hooks/useSwitcherState';
import {
  ProjectGroupSwitcherSidebar,
  usePinnedProjects,
} from '@/features/projects/workspace/components/ProjectGroupSwitcherSidebar';

export interface MizitoPageShellProps {
  /** Drawer item to highlight, e.g. `/notes`. */
  navActiveTo: string;
  /** data-testid of the shell root. */
  testId: string;
  /** Project id for the switcher highlight; empty on pages outside a project. */
  activeProjectId?: string;
  children: ReactNode;
}

/**
 * Mizito page wrapper copied from `MizitoCorrespondencePage`: mizito-light tokens, right-panel switcher
 * (desktop MizitoNav and mobile drawer via mizitoSwitcherBridge), then the page body inside `main`.
 * Shared by the notes, customers and monitoring pages so all three keep the same arrangement.
 */
export function MizitoPageShell({ navActiveTo, testId, activeProjectId = '', children }: MizitoPageShellProps) {
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
    [navigate, setSwitcherOpen],
  );

  return (
    <div
      className="mizito-workspace-light mz-shell font-mz"
      dir="rtl"
      data-testid={testId}
      data-switcher-hidden={desktopHidden ? 'true' : undefined}
    >
      <ProjectGroupSwitcherSidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={selectProject}
        currentUserId={userId}
        mobileOpen={switcherOpen}
        onMobileClose={() => setSwitcherOpen(false)}
        pinnedProjectIds={pins.pinnedIds}
        onTogglePin={pins.togglePin}
        navActiveTo={navActiveTo}
      />
      <main className="mz-main-canvas">{children}</main>
    </div>
  );
}
