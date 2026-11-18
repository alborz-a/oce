import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import type { ChatRoom } from '@/modules/team-chat/types';
import { ProjectGroupTab, type ProjectGroupTabProps } from './ProjectGroupTab';

const EMPTY_TASKS: ProjectGroupTabProps['tasks'] = [];

export interface CompanyChatPanelProps {
  /** Project whose workspace hosts the panel; used only for the shared chat shell. */
  projectId: string;
  currentUserId: string;
  currentUser?: ProjectGroupTabProps['currentUser'];
  members: ProjectGroupTabProps['members'];
  onClose: () => void;
}

/** Company-wide chat (kind=company) rendered inside the Mizito shell. Every logged-in user reads and writes it. */
export function CompanyChatPanel({
  projectId,
  currentUserId,
  currentUser,
  members,
  onClose,
}: CompanyChatPanelProps) {
  const roomQuery = useQuery({
    queryKey: ['team-chat', 'company-room'],
    queryFn: async () => {
      const rooms = await apiGet<ChatRoom[]>('/v1/team-chat/rooms/');
      return rooms.find((room) => room.kind === 'company') ?? null;
    },
  });

  if (roomQuery.isLoading) {
    return <div className="p-4 text-sm text-[#6b7280]" data-testid="company-chat-loading">در حال بارگذاری گفتگوی شرکت…</div>;
  }

  if (roomQuery.isError || !roomQuery.data) {
    return (
      <div role="alert" className="p-4 text-sm text-[#b91c1c]" data-testid="company-chat-error">
        بارگذاری گفتگوی شرکت ممکن نشد.
      </div>
    );
  }

  return (
    <ProjectGroupTab
      projectId={projectId}
      currentUserId={currentUserId}
      currentUser={currentUser}
      tasks={EMPTY_TASKS}
      members={members}
      showFilterBar={false}
      dm={{ room: roomQuery.data, peerName: 'شرکت', peerAvatarUrl: null }}
      onCloseDm={onClose}
    />
  );
}
