// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectAvatar } from '@/shared/ui/ProjectAvatar';
import { deleteProjectPicture, uploadProjectPicture } from '@/features/projects/api';
import { invalidateProjectLists } from '@/features/projects/invalidateProjectLists';

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

export interface ProjectPictureControlProps {
  projectId: string;
  name: string;
  pictureUrl?: string | null;
  color?: string | null;
  /** Only project managers (project.update) see the upload and remove buttons. */
  canManage: boolean;
}

/**
 * Project picture (avatar) preview with upload and remove controls for managers.
 * Non-managers see the avatar only.
 */
export function ProjectPictureControl({ projectId, name, pictureUrl, color, canManage }: ProjectPictureControlProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    invalidateProjectLists(queryClient);
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProjectPicture(projectId, file),
    onSuccess: () => {
      setError(null);
      setNotice('تصویر پروژه ذخیره شد');
      refresh();
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(err instanceof Error && err.message ? err.message : 'ذخیره تصویر انجام نشد');
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteProjectPicture(projectId),
    onSuccess: () => {
      setError(null);
      setNotice('تصویر پروژه حذف شد');
      refresh();
    },
    onError: () => {
      setNotice(null);
      setError('حذف تصویر انجام نشد');
    },
  });

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setNotice(null);
      setError('حجم تصویر بیشتر از ۵ مگابایت است');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setNotice(null);
      setError('فرمت فایل پشتیبانی نمی‌شود (فقط PNG، JPG یا WebP)');
      return;
    }
    uploadMutation.mutate(file);
  };

  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className="flex items-center gap-4" data-testid="project-picture-control" dir="rtl">
      <ProjectAvatar name={name} pictureUrl={pictureUrl} color={color} size={64} />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-content-primary">تصویر پروژه</span>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              data-testid="project-picture-input"
              onChange={onFileChange}
            />
            <button
              type="button"
              className="ps-btn"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              انتخاب تصویر
            </button>
            {pictureUrl ? (
              <button
                type="button"
                className="ps-btn is-danger"
                disabled={busy}
                onClick={() => removeMutation.mutate()}
              >
                حذف تصویر
              </button>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-content-tertiary">فقط مدیر پروژه می‌تواند تصویر را تغییر دهد</span>
        )}
        {error ? (
          <span role="alert" className="text-xs text-red-600">{error}</span>
        ) : notice ? (
          <span role="status" className="text-xs text-content-secondary">{notice}</span>
        ) : null}
      </div>
    </div>
  );
}
