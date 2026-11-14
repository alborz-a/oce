// [RSC-IRAN] File / image detail page: one file, big preview, facts, icon actions.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Copy, Download, Expand, FileQuestion, FileText, Loader2 } from 'lucide-react';
import { AuthImage } from '@/shared/ui';
import { IconButton } from '@/shared/ui/IconButton';
import { DateDisplay } from '@/shared/ui/DateDisplay';
import { useToastStore } from '@/stores/useToastStore';
import { useCanWritePhotos } from './useCanWritePhotos';
import { apiPatch } from '@/shared/lib/api';
import { downloadProtectedFile, fetchFileList } from './api';
import { localizeSize } from './fmt';
import { isImageRow, isLightboxRow } from './kindModule';
import { copyToClipboard } from './lib/tauri';
import { MediaLightbox } from './components/MediaLightbox';
import type { FileRow } from './types';

function sizeText(bytes: number): string {
  if (!bytes) return localizeSize('0 B');
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return localizeSize(`${i === 0 ? v : v.toFixed(1)} ${units[i]}`);
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border-light/60 last:border-0">
      <dt className="text-[11px] font-medium text-content-tertiary">{label}</dt>
      <dd className="text-sm text-content-primary break-words">{children}</dd>
    </div>
  );
}

export function FileDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const [downloading, setDownloading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const queryClient = useQueryClient();
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingCaption, setSavingCaption] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['file-detail', projectId, fileId],
    queryFn: () => fetchFileList(projectId as string, { fileId: fileId as string, limit: 1 }),
    enabled: Boolean(projectId && fileId),
    staleTime: 30_000,
  });
  const row: FileRow | undefined = data?.items[0];

  // Global managers write only where they are team members (the backend refuses otherwise).
  const canEditCaption = useCanWritePhotos(projectId);

  async function saveCaption() {
    if (!row) return;
    setSavingCaption(true);
    try {
      await apiPatch(`/v1/documents/photos/${row.id}`, { caption: captionDraft.trim() });
      await queryClient.invalidateQueries({ queryKey: ['file-detail', projectId, fileId] });
      setEditingCaption(false);
      addToast({ type: 'success', title: t('files.detail.caption_saved', { defaultValue: 'Description saved' }) });
    } catch (err) {
      addToast({
        type: 'error',
        title: t('files.detail.caption_failed', { defaultValue: 'Could not save the description' }),
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingCaption(false);
    }
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(projectId ? `/projects/${projectId}/files` : '/files');
  }

  async function handleDownload() {
    if (!row?.download_url) return;
    setDownloading(true);
    try {
      await downloadProtectedFile(row.download_url, row.name);
    } catch (e) {
      addToast({
        type: 'error',
        title: t('files.actions.download_failed', { defaultValue: 'Could not download the file' }),
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyLink() {
    const ok = await copyToClipboard(window.location.href);
    addToast({
      type: ok ? 'success' : 'error',
      title: ok
        ? t('files.detail.link_copied', { defaultValue: 'Link copied' })
        : t('files.detail.link_copy_failed', { defaultValue: 'Could not copy the link' }),
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-content-tertiary" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-content-secondary">
        <FileQuestion size={40} strokeWidth={1.5} />
        <p className="text-sm">{t('files.detail.not_found', { defaultValue: 'This file was not found' })}</p>
        <IconButton
          label={t('files.detail.back', { defaultValue: 'Back' })}
          icon={<ArrowRight size={16} className="ltr:rotate-180" />}
          onClick={goBack}
        />
      </div>
    );
  }

  const image = isImageRow(row) && Boolean(row.download_url);
  const title = row.caption?.trim() || row.name;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <IconButton
          label={t('files.detail.back', { defaultValue: 'Back' })}
          icon={<ArrowRight size={16} className="ltr:rotate-180" />}
          onClick={goBack}
        />
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-content-primary" title={title}>
          {title}
        </h1>
        {isLightboxRow(row) && row.download_url && (
          <IconButton
            label={t('files.detail.fullscreen', { defaultValue: 'Full screen' })}
            icon={<Expand size={16} />}
            onClick={() => setLightboxOpen(true)}
          />
        )}
        {row.download_url && (
          <IconButton
            label={t('files.actions.download', { defaultValue: 'Download' })}
            icon={downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            variant="primary"
            disabled={downloading}
            onClick={() => void handleDownload()}
          />
        )}
        <IconButton
          label={t('files.detail.copy_link', { defaultValue: 'Copy link' })}
          icon={<Copy size={16} />}
          onClick={() => void handleCopyLink()}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl border border-border-light bg-surface-secondary">
          {image && row.download_url ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="flex h-full w-full items-center justify-center focus:outline-none"
              aria-label={t('files.detail.fullscreen', { defaultValue: 'Full screen' })}
            >
              <AuthImage
                src={row.download_url}
                alt={title}
                fetchPriority="high"
                className="max-h-[75vh] w-full object-contain"
                placeholder={<Loader2 size={28} className="animate-spin text-content-tertiary" />}
                fallback={<FileQuestion size={48} strokeWidth={1.5} className="text-content-tertiary" />}
              />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-content-tertiary">
              <FileText size={56} strokeWidth={1.25} />
              <span className="text-xs">
                {t('files.detail.no_preview', { defaultValue: 'No preview for this file type' })}
              </span>
            </div>
          )}
        </div>

        <dl className="h-fit rounded-xl border border-border-light bg-surface-primary px-4 py-2">
          <Fact label={t('files.detail.name', { defaultValue: 'File name' })}>{row.name}</Fact>
          {(row.caption || (row.kind === 'photo' && canEditCaption)) && (
            <Fact label={t('files.detail.caption', { defaultValue: 'Description' })}>
              {editingCaption ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    data-testid="photo-caption-input"
                    value={captionDraft}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid="photo-caption-save"
                      disabled={savingCaption}
                      onClick={() => void saveCaption()}
                      className="rounded-lg bg-oe-blue px-3 py-1 text-xs text-white disabled:opacity-60"
                    >
                      {t('common.save', { defaultValue: 'Save' })}
                    </button>
                    <button
                      type="button"
                      data-testid="photo-caption-cancel"
                      onClick={() => setEditingCaption(false)}
                      className="rounded-lg border border-border px-3 py-1 text-xs"
                    >
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </button>
                  </div>
                </div>
              ) : (
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">{row.caption || '—'}</span>
                  {row.kind === 'photo' && canEditCaption && (
                    <button
                      type="button"
                      data-testid="photo-caption-edit"
                      onClick={() => {
                        setCaptionDraft(row.caption ?? '');
                        setEditingCaption(true);
                      }}
                      className="shrink-0 text-xs text-oe-blue hover:underline"
                    >
                      {t('common.edit', { defaultValue: 'Edit' })}
                    </button>
                  )}
                </span>
              )}
            </Fact>
          )}
          <Fact label={t('files.detail.type', { defaultValue: 'Type' })}>
            {(row.extension ?? row.mime_type ?? '').toUpperCase() || '—'}
          </Fact>
          <Fact label={t('files.detail.size', { defaultValue: 'Size' })}>{sizeText(row.size_bytes)}</Fact>
          <Fact label={t('files.detail.modified', { defaultValue: 'Last change' })}>
            <DateDisplay value={row.modified_at} format="datetime" />
          </Fact>
          {row.category && <Fact label={t('files.detail.category', { defaultValue: 'Category' })}>{row.category}</Fact>}
          <Fact label={t('files.detail.path', { defaultValue: 'Location' })}>
            <span dir="ltr" className="block text-xs text-content-secondary">
              {row.relative_path || row.physical_path}
            </span>
          </Fact>
        </dl>
      </div>

      <MediaLightbox
        open={lightboxOpen}
        items={[row]}
        index={0}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
