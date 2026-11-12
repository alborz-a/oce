import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';

import { AuthImage } from '@/shared/ui';

/** Blurred thumbnail (when known) + spinner, so the stage is never an empty
 *  frame while a cold photo takes several seconds to arrive. */
export function PhotoLoading({ thumbnailUrl }: { thumbnailUrl: string | null }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="media-lightbox-loading"
      className="relative flex h-[60vh] w-[90vw] max-w-3xl items-center justify-center overflow-hidden rounded-lg bg-white/10"
    >
      {thumbnailUrl && (
        <AuthImage
          src={thumbnailUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
        />
      )}
      <div className="relative flex flex-col items-center gap-2 text-white/90">
        <Loader2 size={32} className="animate-spin" />
        <span className="text-xs">
          {t('common.loading', { defaultValue: 'Loading...' })}
        </span>
      </div>
    </div>
  );
}

export function MediaError({ onDownload }: { onDownload?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-white/80">
        {t('files.preview.media_failed', {
          defaultValue: 'This file could not be displayed here.',
        })}
      </p>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
        >
          <Download size={13} />
          {t('files.actions.download', { defaultValue: 'Download' })}
        </button>
      )}
    </div>
  );
}
