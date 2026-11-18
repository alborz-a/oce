// frontend/src/features/projects/components/ProjectMembersCard.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { apiDelete, apiGet, apiPost, getErrorMessage } from '@/shared/lib/api';
import { useVisibleMembers } from '@/shared/lib/hiddenUsers';
import { toPersianDigits } from '@/shared/lib/jalali';
import { AuthImage } from '@/shared/ui/AuthImage';
import { Card, CardHeader } from '@/shared/ui';
import { UserSearchInput } from '@/shared/ui/UserSearchInput';
import { useToastStore } from '@/stores/useToastStore';
import { getInitials, type ProjectMember } from './TeamStrip';

const ROLE_LABELS: Record<string, string> = {
  project_manager: 'مدیر پروژه',
  owner: 'مالک پروژه',
  lead: 'سرپرست',
  estimator: 'برآوردگر',
  member: 'عضو',
  viewer: 'بیننده',
};

const ELEVATED_ROLES = new Set(['project_manager', 'owner', 'lead']);

export interface ProjectMembersCardProps {
  projectId: string;
  canManage: boolean;
  canGrantElevated: boolean;
}

export function ProjectMembersCard({
  projectId,
  canManage,
  canGrantElevated,
}: ProjectMembersCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [role, setRole] = useState<'estimator' | 'viewer' | 'project_manager' | 'member'>('member');
  const [showAddForm, setShowAddForm] = useState(false);

  // Uses the exact same queryKey + endpoint as TeamStrip.tsx
  const { data: allMembers = [], isLoading } = useQuery<ProjectMember[]>({
    queryKey: ['project-members', projectId],
    queryFn: () => apiGet<ProjectMember[]>(`/v1/projects/${projectId}/members/`),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const members = useVisibleMembers(allMembers);

  const addMutation = useMutation({
    mutationFn: (payload: { user_id: string; role: string }) =>
      apiPost<ProjectMember>(`/v1/projects/${projectId}/members/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      setSelectedUserId('');
      setSelectedName('');
      setShowAddForm(false);
      addToast({ type: 'success', title: t('projects.team.added', { defaultValue: 'عضو به پروژه اضافه شد' }) });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: t('projects.team.add_failed', { defaultValue: 'خطا در افزودن عضو' }),
        message: getErrorMessage(err),
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      apiDelete(`/v1/projects/${projectId}/members/${memberUserId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      addToast({ type: 'success', title: t('projects.team.removed', { defaultValue: 'عضو از پروژه حذف شد' }) });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: t('projects.team.remove_failed', { defaultValue: 'خطا در حذف عضو' }),
        message: getErrorMessage(err),
      });
    },
  });

  return (
    <Card id="project-members">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1f5c88]/10 text-[#1f5c88]">
              <Users size={14} />
            </span>
            <span>{t('projects.team.modal_members_title', { defaultValue: 'اعضای پروژه' })}</span>
            <span className="text-xs font-normal text-content-tertiary">
              ({toPersianDigits(members.length)} نفر)
            </span>
          </span>
        }
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f5c88]/30 bg-[#1f5c88]/5 px-3 py-1.5 text-xs font-medium text-[#1f5c88] hover:bg-[#1f5c88]/10 transition-colors"
              data-testid="project-settings-add-member-btn"
            >
              <UserPlus size={15} />
              <span>{t('projects.team.add_member', { defaultValue: 'افزودن اعضا' })}</span>
            </button>
          ) : undefined
        }
      />

      {/* Inline Add-Member Picker (UserSearchInput hits GET /v1/projects/{id}/member-candidates/) */}
      {canManage && showAddForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedUserId) return;
            addMutation.mutate({ user_id: selectedUserId, role });
          }}
          className="mb-4 rounded-lg border border-[#e3e5e8] bg-[#f9fafb] p-3 space-y-3"
          dir="rtl"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <UserSearchInput
                projectId={projectId}
                value={selectedUserId}
                displayValue={selectedName}
                placeholder="جستجوی نام یا ایمیل همکار..."
                onChange={(id, name) => {
                  setSelectedUserId(id);
                  setSelectedName(name);
                }}
              />
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="h-10 rounded-lg border border-border bg-surface-primary px-3 text-sm"
            >
              <option value="member">عضو</option>
              <option value="estimator">برآوردگر</option>
              <option value="viewer">بیننده</option>
              {canGrantElevated && <option value="project_manager">مدیر پروژه</option>}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-content-secondary hover:bg-surface-secondary"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={!selectedUserId || addMutation.isPending}
              className="rounded-lg bg-[#0f9d58] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#0c8549] disabled:opacity-50"
            >
              {addMutation.isPending ? 'در حال افزودن...' : 'افزودن به پروژه'}
            </button>
          </div>
        </form>
      )}

      {/* Member Rows — Mizito .member-item parity */}
      {isLoading ? (
        <div className="py-4 text-xs text-content-tertiary">در حال بارگذاری اعضا...</div>
      ) : (
        <ul className="flex flex-col gap-1" dir="rtl">
          {members.map((m) => {
            const isElevated = m.is_owner || ELEVATED_ROLES.has(m.role);
            const canDeleteThisRow = canManage && !m.is_owner;
            return (
              <li
                key={m.user_id}
                className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 transition-colors hover:bg-[#f1f3f4]"
                data-testid="project-settings-member-row"
              >
                {m.avatar_url ? (
                  <AuthImage
                    src={m.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                    fallback={getInitials(m)}
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f5c88] text-xs font-semibold text-white">
                    {getInitials(m)}
                  </div>
                )}

                <div className="min-w-0 flex-1 pe-2">
                  <div className="truncate text-sm font-medium text-content-primary">
                    {m.full_name || m.email}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs">
                    {isElevated ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#2e7d32]">
                        <ShieldCheck
                          size={14}
                          className={m.is_owner ? 'text-[#ffc107]' : 'text-[#009688]'}
                        />
                        {m.is_owner ? 'مالک پروژه' : (ROLE_LABELS[m.role] ?? m.role)}
                      </span>
                    ) : (
                      <span className="text-[#777]">
                        {ROLE_LABELS[m.role] ?? m.role} · {m.email}
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    disabled={!canDeleteThisRow || removeMutation.isPending}
                    onClick={() => removeMutation.mutate(m.user_id)}
                    title={canDeleteThisRow ? 'حذف از پروژه' : 'مالک پروژه قابل حذف نیست'}
                    aria-label="حذف از پروژه"
                    className={
                      canDeleteThisRow
                        ? 'flex h-7 w-7 items-center justify-center rounded-full text-[#999] hover:bg-red-50 hover:text-[#f44336] transition-colors'
                        : 'flex h-7 w-7 items-center justify-center rounded-full text-[#999] opacity-30 cursor-not-allowed'
                    }
                    data-testid="project-settings-remove-member-btn"
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
