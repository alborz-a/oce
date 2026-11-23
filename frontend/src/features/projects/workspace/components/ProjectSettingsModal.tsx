import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet } from '@/shared/lib/api';
import { toPersianDigits } from '@/shared/lib/jalali';
import { projectsApi } from '@/features/projects/api';
import { useProjectCaps } from '@/shared/hooks/useProjectCaps';
import { ProjectPictureControl } from './ProjectPictureControl';
import { MzIcon } from './MzIcon';
import { ProjectSettingsMembersPicker } from './ProjectSettingsMembersPicker';
import '../project-settings.css';

/** Row from GET /v1/projects/{id}/members/ (ProjectMemberResponse subset). */
export interface ProjectSettingsMember {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_owner: boolean;
}

export interface ProjectSettingsModalProps {
  /** Controls visibility. Opened from the summary panel pencil button (follow-up wiring). */
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  /** Called after the project is archived, so the host can navigate away. */
  onArchived?: () => void;
}

/** Owner-level roles get the «مدیر گروه» badge (Mizito `.combined-admin-role`). */
export function isGroupAdminRole(member: Pick<ProjectSettingsMember, 'role' | 'is_owner'>): boolean {
  return member.is_owner || member.role === 'owner' || member.role === 'project_manager';
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('');
}

interface PsToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/** Local green switch (role=switch). No backend endpoint exists for these flags yet. */
function PsToggle({ label, checked, onChange }: PsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? 'ps-toggle is-on' : 'ps-toggle'}
      onClick={() => onChange(!checked)}
    >
      <span className="ps-toggle-knob" aria-hidden="true" />
    </button>
  );
}

/**
 * Project settings modal (Mizito `md-dialog.modal-dialog-info`, light theme).
 * Wired only to existing OCE endpoints: projects PATCH/DELETE, members list/remove, member-candidates + members/bulk.
 * Sub-features without an endpoint are local UI only or omitted (see PR body): groups chip, palette, advanced settings handler.
 */
export function ProjectSettingsModal({ open, onClose, projectId, projectName, onArchived }: ProjectSettingsModalProps) {
  const queryClient = useQueryClient();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(projectName);
  const [showPicker, setShowPicker] = useState(false);
  const [archiveArmed, setArchiveArmed] = useState(false);
  const [advancedOn, setAdvancedOn] = useState(false);
  const [notifyOn, setNotifyOn] = useState(true);
  const { can: canProjectCap } = useProjectCaps(open ? projectId : null);
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: open,
  });

  const membersQuery = useQuery({
    queryKey: ['project-settings-members', projectId],
    queryFn: () => apiGet<ProjectSettingsMember[]>(`/v1/projects/${projectId}/members/`),
    enabled: open,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => projectsApi.update(projectId, { name }),
    onSuccess: () => {
      setEditingTitle(false);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => projectsApi.archive(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      onArchived?.();
      onClose();
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => apiDelete(`/v1/projects/${projectId}/members/${userId}/`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['project-settings-members', projectId] }),
  });

  if (!open) return null;

  const members = membersQuery.data ?? [];
  const existingIds = members.map((m) => m.user_id);

  const startTitleEdit = () => {
    setTitleDraft(projectName);
    setEditingTitle(true);
  };

  const submitTitle = () => {
    const next = titleDraft.trim();
    if (!next || next === projectName) {
      setEditingTitle(false);
      return;
    }
    renameMutation.mutate(next);
  };

  return createPortal(
    <div className="ps-modal-backdrop" data-testid="project-settings-backdrop">
      <div className="ps-modal" role="dialog" aria-modal="true" aria-label="تنظیمات پروژه" dir="rtl">
        <div className="ps-modal-header">
          <ProjectPictureControl
            compact
            projectId={projectId}
            name={projectName}
            pictureUrl={projectQuery.data?.picture_url ?? null}
            color={projectQuery.data?.color ?? null}
            canManage={canProjectCap('project.update')}
          />
          <div className="ps-header-info">
            {editingTitle ? (
              <div className="ps-title-row">
                <input
                  className="ps-title-input"
                  aria-label="عنوان پروژه"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitTitle();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                />
                <button type="button" className="ps-icon-btn" aria-label="تایید" onClick={submitTitle}
                  disabled={renameMutation.isPending}>
                  <MzIcon name="check" size={18} />
                </button>
                <button type="button" className="ps-icon-btn" aria-label="انصراف" onClick={() => setEditingTitle(false)}>
                  <MzIcon name="close" size={18} />
                </button>
              </div>
            ) : (
              <div className="ps-title-row">
                <span className="ps-project-title">{projectName}</span>
                <button type="button" className="ps-icon-btn" aria-label="ویرایش عنوان" onClick={startTitleEdit}>
                  <MzIcon name="edit" size={18} />
                </button>
              </div>
            )}
            {renameMutation.isError && <div className="ps-error">خطا در ذخیره عنوان</div>}
          </div>
          <button type="button" className="ps-icon-btn close-btn" aria-label="بستن پنجره" onClick={onClose}>
            <MzIcon name="close" size={20} />
          </button>
        </div>

        <div className="ps-body">
          <section className="ps-card">
            <div className="ps-card-title">
              <MzIcon name="tune" size={16} color="var(--ps-green)" />
              <span>تنظیمات پروژه</span>
            </div>
            <div className="ps-row">
              <span className="ps-row-label">
                <MzIcon name="build" size={18} />
                <span>پروژه پیشرفته</span>
              </span>
              <span className="ps-row-control">
                <PsToggle label="پروژه پیشرفته" checked={advancedOn} onChange={setAdvancedOn} />
                <button type="button" className="ps-green-btn">تنظیمات پروژه پیشرفته</button>
              </span>
            </div>
            <div className="ps-divider" />
            <button type="button" className="ps-row ps-row-action" aria-label="افزودن اعضا"
              onClick={() => setShowPicker((v) => !v)}>
              <span className="ps-row-label">
                <MzIcon name="person_add" size={18} />
                <span>افزودن اعضا</span>
              </span>
            </button>
            {showPicker && (
              <ProjectSettingsMembersPicker
                projectId={projectId}
                existingUserIds={existingIds}
                onDone={() => {
                  setShowPicker(false);
                  void queryClient.invalidateQueries({ queryKey: ['project-settings-members', projectId] });
                }}
              />
            )}
            <div className="ps-row">
              <span className="ps-row-label">
                <MzIcon name="chat_bubble_outline" size={18} />
                <span>فعال بودن اعلانات (نوتیفیکیشن)</span>
              </span>
              <span className="ps-row-control">
                <PsToggle label="فعال بودن اعلانات (نوتیفیکیشن)" checked={notifyOn} onChange={setNotifyOn} />
              </span>
            </div>
            {!archiveArmed ? (
              <button type="button" className="ps-row ps-row-action is-danger" aria-label="آرشیو پروژه"
                onClick={() => setArchiveArmed(true)}>
                <span className="ps-row-label">
                  <MzIcon name="archive" size={18} />
                  <span>آرشیو پروژه</span>
                </span>
              </button>
            ) : (
              <div className="ps-picker-actions">
                <button type="button" className="ps-btn is-primary" disabled={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate()}>
                  تایید آرشیو
                </button>
                <button type="button" className="ps-btn" onClick={() => setArchiveArmed(false)}>
                  انصراف
                </button>
              </div>
            )}
          </section>

          <section className="ps-card">
            <div className="ps-card-title">
              <MzIcon name="group" size={16} />
              <span>اعضای پروژه</span>
              <span className="ps-card-count">({toPersianDigits(members.length)} نفر)</span>
            </div>
            <div className="ps-members-list">
              {members.map((m) => (
                <div key={m.user_id} className="ps-member-item">
                  <span className="ps-avatar" aria-hidden="true">{initialsOf(m.full_name || m.email)}</span>
                  <div className="ps-member-info">
                    <span className="ps-member-name">{m.full_name || m.email}</span>
                    {isGroupAdminRole(m) && (
                      <span className="ps-member-role">
                        <MzIcon name="verified_user" size={14} />
                        <span>مدیر گروه</span>
                      </span>
                    )}
                  </div>
                  {!m.is_owner && (
                    <button type="button" className="ps-icon-btn" aria-label="حذف از پروژه"
                      disabled={removeMemberMutation.isPending}
                      onClick={() => removeMemberMutation.mutate(m.user_id)}>
                      <MzIcon name="clear" size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
