import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/shared/lib/api';

/** Row from GET /v1/projects/{id}/member-candidates (id, email, full_name). */
export interface ProjectMemberCandidate {
  id: string;
  email: string;
  full_name: string;
}

export interface ProjectSettingsMembersPickerProps {
  projectId: string;
  /** User ids already in the project; they are hidden from the picker. */
  existingUserIds: readonly string[];
  onDone: () => void;
}

/**
 * «افزودن اعضا» picker. Lists candidates, multi-select, then POST members/bulk.
 * Uses only existing OCE endpoints: member-candidates and members/bulk.
 */
export function ProjectSettingsMembersPicker({ projectId, existingUserIds, onDone }: ProjectSettingsMembersPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const candidatesQuery = useQuery({
    queryKey: ['project-settings-candidates', projectId],
    queryFn: () => apiGet<ProjectMemberCandidate[]>(`/v1/projects/${projectId}/member-candidates`),
  });

  const addMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      apiPost(`/v1/projects/${projectId}/members/bulk/`, {
        members: userIds.map((user_id) => ({ user_id, role: 'member' })),
      }),
    onSuccess: () => onDone(),
  });

  const existing = new Set(existingUserIds);
  const candidates = (candidatesQuery.data ?? []).filter((c) => !existing.has(c.id));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="ps-picker" dir="rtl" data-testid="ps-members-picker">
      <div className="ps-picker-list">
        {candidatesQuery.isLoading && <span className="ps-picker-item">…</span>}
        {candidates.map((c) => (
          <label key={c.id} className="ps-picker-item">
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={() => toggle(c.id)}
            />
            <span>{c.full_name || c.email}</span>
          </label>
        ))}
      </div>
      {addMutation.isError && <div className="ps-error">خطا در افزودن اعضا</div>}
      <div className="ps-picker-actions">
        <button type="button" className="ps-btn is-primary" disabled={selected.length === 0 || addMutation.isPending}
          onClick={() => addMutation.mutate(selected)}>
          تایید
        </button>
        <button type="button" className="ps-btn" onClick={onDone}>
          انصراف
        </button>
      </div>
    </div>
  );
}
