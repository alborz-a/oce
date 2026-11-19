import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import { fetchAllTasks } from '@/features/tasks/api';
import { MzIcon } from '@/features/projects/workspace/components/MzIcon';
import { isTopicConversationTask } from '@/features/projects/workspace/hooks/useProjectWorkspaceStats';
import type { ProjectTaskItem, WorkspaceMember } from '@/features/projects/workspace/types';
import { useVisibleMembers } from '@/shared/lib/hiddenUsers';
import { toPersianDigits } from '@/shared/lib/jalali';
import { getIntlLocale } from '@/shared/lib/intlLocale';
import { useGlobalPresenceStore } from '@/stores/useGlobalPresenceStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { MizitoPageShell } from '@/modules/_shared/MizitoPageShell';

const ONLINE = '#0f9d58';
const OFFLINE = '#607d8b';

/** Same rule as the switcher colleague list: first open (not done) task per responsible user, in_progress wins. */
function currentTaskByUser(tasks: ProjectTaskItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const task of tasks) {
    if (isTopicConversationTask(task)) continue;
    const uid = task.responsible_id;
    if (!uid) continue;
    const status = (task.status ?? '').trim().toLowerCase();
    if (status === 'done' || status === 'completed') continue;
    if (!map.has(uid) || status === 'in_progress') map.set(uid, task.title);
  }
  return map;
}

export function MonitoringModule() {
  const projectId = useProjectContextStore((s) => s.activeProjectId) ?? '';
  const presenceUsers = useGlobalPresenceStore((s) => s.users);

  const membersQuery = useQuery({
    queryKey: ['monitoring-members', projectId],
    queryFn: () => apiGet<WorkspaceMember[]>(`/v1/projects/${projectId}/members/`),
    enabled: !!projectId,
  });
  const tasksQuery = useQuery({
    queryKey: ['monitoring-tasks', projectId],
    queryFn: async () => (await fetchAllTasks({ project_id: projectId })) as unknown as ProjectTaskItem[],
    enabled: !!projectId,
  });

  const members = useVisibleMembers(membersQuery.data ?? []);
  const tasksByUser = useMemo(() => currentTaskByUser(tasksQuery.data ?? []), [tasksQuery.data]);

  const rows = members.map((m) => {
    const presence = presenceUsers[m.user_id];
    return {
      member: m,
      online: presence?.status === 'active',
      lastActive: presence?.last_active ?? null,
      task: tasksByUser.get(m.user_id) ?? '',
    };
  });
  const onlineCount = rows.filter((r) => r.online).length;
  const offlineCount = rows.length - onlineCount;

  return (
    <MizitoPageShell navActiveTo="/monitoring" testId="mizito-monitoring">
      <section className="p-4" data-testid="monitoring-page">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-[18px] font-semibold text-[#1f2937]">مانیتورینگ همکاران</h1>
          <span data-testid="monitoring-online-count" className="rounded-full px-2.5 py-0.5 text-[12.5px] text-white" style={{ background: ONLINE }}>
            آنلاین {toPersianDigits(onlineCount)}
          </span>
          <span data-testid="monitoring-offline-count" className="rounded-full px-2.5 py-0.5 text-[12.5px] text-white" style={{ background: OFFLINE }}>
            آفلاین {toPersianDigits(offlineCount)}
          </span>
        </header>

        {!projectId ? (
          <p data-testid="monitoring-no-project" className="py-10 text-center text-[13px] text-[#607d8b]">
            پروژه‌ای انتخاب نشده است
          </p>
        ) : null}

        {projectId && rows.length === 0 && !membersQuery.isLoading ? (
          <p data-testid="monitoring-empty" className="py-10 text-center text-[13px] text-[#607d8b]">
            عضوی در این گروه ثبت نشده است
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-[#e5e7eb] bg-white">
            <table className="w-full text-start text-[13px]" data-testid="monitoring-table">
              <thead className="bg-[#f5f6f8] text-[12px] text-[#607d8b]">
                <tr>
                  <th className="px-3 py-2 font-medium">همکار</th>
                  <th className="px-3 py-2 font-medium">وضعیت</th>
                  <th className="px-3 py-2 font-medium">کار فعلی</th>
                  <th className="px-3 py-2 font-medium">آخرین فعالیت</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.member.user_id} data-testid={`monitoring-row-${r.member.user_id}`} className="border-t border-[#e5e7eb]">
                    <td className="px-3 py-2 text-[#1f2937]">{r.member.full_name || r.member.email}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          data-testid={`monitoring-dot-${r.member.user_id}`}
                          data-online={r.online ? 'true' : 'false'}
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: r.online ? ONLINE : OFFLINE }}
                        />
                        {r.online ? 'آنلاین' : 'آفلاین'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#4b5563]">{r.task || '—'}</td>
                    <td className="px-3 py-2 text-[#607d8b] tabular-nums">
                      {r.lastActive ? new Date(r.lastActive).toLocaleString(getIntlLocale()) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-3 flex items-center gap-1 text-[11.5px] text-[#909090]">
          <MzIcon name="sync" size={13} />
          وضعیت به‌صورت زنده از اتصال همکاران به‌روز می‌شود
        </p>
      </section>
    </MizitoPageShell>
  );
}

export default MonitoringModule;
