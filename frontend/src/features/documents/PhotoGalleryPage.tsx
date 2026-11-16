// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Photo Gallery page — delegates to PhotosTab (D2 rsd-rsc#95 single photo UI).
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Breadcrumb } from '@/shared/ui';
import { PageHeader } from '@/shared/ui/PageHeader';
import { RequiresProject } from '@/shared/auth/RequiresProject';
import { fetchProjectList } from '@/shared/lib/projectList';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { PhotosTab } from '@/features/projects/PhotosTab';

export function PhotoGalleryPage() {
  const { t } = useTranslation();
  const activeProjectId = useProjectContextStore((s) => s.activeProjectId);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjectList<{ id: string; name: string }[]>(),
    staleTime: 5 * 60_000,
    enabled: !activeProjectId,
  });

  const projectId = activeProjectId || projects[0]?.id || '';

  return (
    <div className="space-y-5 animate-fade-in">
      <Breadcrumb
        items={[
          { label: t('photos.title', { defaultValue: 'Project Photos' }) },
        ]}
      />
      <PageHeader srTitle={t('photos.title', { defaultValue: 'Project Photos' })} />
      <RequiresProject
        emptyHint={t('photos.select_project', {
          defaultValue: 'Select a project from the header to view its photo documentation.',
        })}
      >
        <PhotosTab projectId={projectId} />
      </RequiresProject>
    </div>
  );
}
