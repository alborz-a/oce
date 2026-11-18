import { useCallback, useEffect, useMemo, useState } from 'react';
import { registerMizitoSwitcher } from '../mizitoSwitcherBridge';
import { useSwitcherState } from '../hooks/useSwitcherState';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '@/shared/lib/api';
import { fetchAllTasks } from '@/features/tasks/api';
import { projectsApi, type Project } from '@/features/projects/api';
import { useAuthStore } from '@/stores/useAuthStore';
import '../workspace.css';
import { useProjectWorkspaceStats } from '../hooks/useProjectWorkspaceStats';
import { isSyntheticAlbumTask } from '../syntheticAlbumTask';
import {
  DEFAULT_STREAM_FILTERS,
  type ProjectTaskItem,
  type StreamFilterState,
  type WorkspaceMember,
  type WorkspaceTabKey,
} from '../types';
import { ProjectGroupSwitcherSidebar, usePinnedProjects } from './ProjectGroupSwitcherSidebar';
import { MizitoTopTabAndFilterBar } from './MizitoTopTabAndFilterBar';
import { MizitoMobileSubheader } from './MizitoMobileSubheader';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { ProjectRightSummaryPanel } from './ProjectRightSummaryPanel';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';
import { ProjectGroupTab } from './ProjectGroupTab';
import { CompanyChatPanel } from './CompanyChatPanel';
import { useOpenColleagueDm } from '../hooks/useOpenColleagueDm';
import { WorkspaceDmContext, type WorkspaceDmValue } from '../context/WorkspaceDmContext';
import type { ChatRoom } from '@/modules/team-chat/types';
import { ProjectStreamFilterBar } from './ProjectStreamFilterBar';
import { ProjectTasksTab } from './ProjectTasksTab';
import { ProjectBoardTab } from './ProjectBoardTab';
import { ProjectCalendarTab } from './ProjectCalendarTab';
import { ProjectGanttTab } from './ProjectGanttTab';
import { TaskQuickDetailDialog } from './TaskQuickDetailDialog';

export interface MizitoProjectWorkspaceProps {
  projectId: string;
  canSwitchToEngineering?: boolean;
  onSwitchToEngineering?: () => void;
}

export function MizitoProjectWorkspace({
  projectId,
  canSwitchToEngineering = false,
  onSwitchToEngineering,
}: MizitoProjectWorkspaceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId) ?? '';
  const userFullName = useAuthStore((s) => s.userFullName);
  const userRole = useAuthStore((s) => s.userRole);
  const userEmail = useAuthStore((s) => s.userEmail);

  const setChromeActive = useWorkspaceChromeStore((st) => st.setActive);
  useEffect(() => {
    // Hide the OCE sidebar/header and force light tokens (dialogs and popovers render outside the root).
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

  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('group');
  const [filters, setFilters] = useState<StreamFilterState>(DEFAULT_STREAM_FILTERS);
  const {
    open: switcherOpen,
    setOpen: setSwitcherOpen,
    desktopHidden,
    onMenuClick: onSwitcherMenuClick,
  } = useSwitcherState();
  useEffect(() => registerMizitoSwitcher(onSwitcherMenuClick), [onSwitcherMenuClick]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [focusedBoardKey, setFocusedBoardKey] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ProjectTaskItem | null>(null);
  const [activeDm, setActiveDm] = useState<{
    room: ChatRoom;
    peerName: string;
    peerAvatarUrl: string | null;
  } | null>(null);

  const [companyChatOpen, setCompanyChatOpen] = useState(false);
  useEffect(() => setCompanyChatOpen(false), [projectId]);

  const projectsQuery = useQuery({
    queryKey: ['projects', 'workspace-switcher'],
    queryFn: () => projectsApi.list(),
  });
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  });
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => apiGet<WorkspaceMember[]>(`/v1/projects/${projectId}/members/`),
    enabled: !!projectId,
  });
  const tasksQuery = useQuery({
    queryKey: ['project-workspace-tasks', projectId],
    queryFn: async () => {
      const items = await fetchAllTasks({ project_id: projectId });
      return items as unknown as ProjectTaskItem[];
    },
    enabled: !!projectId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const projects: Project[] = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const members: WorkspaceMember[] = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const allTasks: ProjectTaskItem[] = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const tasks: ProjectTaskItem[] = useMemo(
    () => allTasks.filter((t) => !isSyntheticAlbumTask(t)),
    [allTasks],
  );
  const project: Project | undefined =
    projectQuery.data ?? projects.find((p) => p.id === projectId);

  const stats = useProjectWorkspaceStats(tasks, userId);
  const pins = usePinnedProjects(userId, projects);

  const onTasksChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['project-workspace-tasks', projectId] });
  }, [queryClient, projectId]);

  const selectProject = useCallback(
    (id: string) => {
      setSwitcherOpen(false);
      navigate(`/projects/${id}`);
    },
    [navigate],
  );

  const handleDmRoomOpened = useCallback(
    (room: ChatRoom, otherUserId: string) => {
      const peer = members.find((m) => m.user_id === otherUserId);
      setActiveDm({
        room,
        peerName: peer?.full_name || peer?.email || 'همکار',
        peerAvatarUrl: peer?.avatar_url ?? null,
      });
      setSwitcherOpen(false);
    },
    [members],
  );
  const openColleagueDm = useOpenColleagueDm(userId, handleDmRoomOpened);
  const dmValue: WorkspaceDmValue = useMemo(() => ({ openDm: openColleagueDm }), [openColleagueDm]);

  const canManage = userRole === 'admin' || userRole === 'manager' || userRole === 'project_manager';
  const currentUser = useMemo(
    () => ({ id: userId, full_name: userFullName ?? undefined, email: userEmail ?? undefined }),
    [userId, userFullName, userEmail],
  );

  return (
    <WorkspaceDmContext.Provider value={dmValue}>
    <div
      className="mizito-workspace-light mz-shell font-mz"
      dir="rtl"
      data-testid="mizito-workspace"
      data-switcher-hidden={desktopHidden ? 'true' : undefined}
    >
      <ProjectGroupSwitcherSidebar
        projects={projects}
        activeProjectId={projectId}
        onSelectProject={selectProject}
        currentUserId={userId}
        members={members}
        tasks={tasks}
        mobileOpen={switcherOpen}
        onMobileClose={() => setSwitcherOpen(false)}
        pinnedProjectIds={pins.pinnedIds}
        onTogglePin={pins.togglePin}
        onOpenCompanyChat={() => {
          setActiveDm(null);
          setCompanyChatOpen(true);
        }}
      />

      {project ? (
        <ProjectRightSummaryPanel
          project={project}
          stats={stats}
          members={members}
          currentUserId={userId}
          canManageMembers={canManage}
          canOpenSettings={canManage}
          isPinned={pins.pinnedIds.includes(projectId)}
          onTogglePin={() => pins.togglePin(projectId)}
          onBack={() => navigate('/projects')}
          onOpenSettings={() => navigate(`/projects/${projectId}/settings`)}
          onStartOnlineMeeting={() => navigate(`/projects/${projectId}/meetings`)}
          onOpenLetters={() => navigate(`/projects/${projectId}/correspondence`)}
          onBoardClick={(key) => {
            setFocusedBoardKey(key);
            setActiveTab('board');
          }}
          mobileOpen={summaryOpen}
          onMobileClose={() => setSummaryOpen(false)}
        />
      ) : (
        <aside className="mz-summary-col" aria-busy="true" />
      )}
      {project && (
        <ProjectSettingsModal
          open={mobileSettingsOpen}
          onClose={() => setMobileSettingsOpen(false)}
          projectId={project.id}
          projectName={project.name}
        />
      )}

      <main className="mz-main-canvas">
        {project && (
          <MizitoMobileSubheader
            project={{
              id: project.id,
              name: project.name,
              avatar_url: typeof project.metadata?.avatar_url === 'string' ? project.metadata.avatar_url : null,
            }}
            onOpenSettings={() => setMobileSettingsOpen(true)}
            onStartMeeting={() => navigate(`/projects/${projectId}/meetings`)}
          />
        )}
        <MizitoTopTabAndFilterBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setCompanyChatOpen(false);
            setActiveTab(tab);
          }}
          filters={filters}
          onFiltersChange={setFilters}
          filterSlot={
            activeTab === 'group' ? (
              <ProjectStreamFilterBar filter={filters} onChange={setFilters} members={members} />
            ) : undefined
          }
          canSwitchToEngineering={canSwitchToEngineering}
          onSwitchToEngineering={onSwitchToEngineering}
          onOpenMobileSummary={() => setSummaryOpen(true)}
        />
        {companyChatOpen && (
          <CompanyChatPanel
            projectId={projectId}
            currentUserId={userId}
            currentUser={{ id: userId, full_name: userFullName ?? undefined, email: userEmail ?? undefined }}
            members={members}
            onClose={() => setCompanyChatOpen(false)}
          />
        )}
        {activeTab === 'group' && !companyChatOpen && (
          <ProjectGroupTab
            projectId={projectId}
            currentUserId={userId}
            currentUser={currentUser}
            tasks={tasks}
            members={members}
            onTasksChanged={onTasksChanged}
            filter={filters}
            onFilterChange={setFilters}
            showFilterBar={false}
            dm={activeDm}
            onCloseDm={() => setActiveDm(null)}
          />
        )}
        {activeTab === 'tasks' && !companyChatOpen && (
          <ProjectTasksTab
            projectId={projectId}
            tasks={tasks}
            members={members}
            onTasksChanged={onTasksChanged}
            onSelectTask={setSelectedTask}
          />
        )}
        {activeTab === 'board' && !companyChatOpen && (
          <ProjectBoardTab
            projectId={projectId}
            tasks={tasks}
            members={members}
            focusedBoardKey={focusedBoardKey}
            onTasksChanged={onTasksChanged}
            onSelectTask={setSelectedTask}
          />
        )}
        {activeTab === 'calendar' && !companyChatOpen && (
          <ProjectCalendarTab
            projectId={projectId}
            tasks={tasks}
            projectName={project?.name}
            onSelectTask={setSelectedTask}
            onTasksChanged={onTasksChanged}
          />
        )}
        {activeTab === 'gantt' && !companyChatOpen && (
          <ProjectGanttTab
            projectId={projectId}
            tasks={tasks}
            projectName={project?.name}
            onSelectTask={setSelectedTask}
          />
        )}
      </main>

      <TaskQuickDetailDialog
        projectId={projectId}
        task={selectedTask}
        open={selectedTask !== null}
        members={members}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => {
          onTasksChanged();
        }}
      />
    </div>
    </WorkspaceDmContext.Provider>
  );
}
