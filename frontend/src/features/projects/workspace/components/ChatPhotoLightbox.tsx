import { useEffect, useRef, useState } from 'react';
import { MzIcon } from './MzIcon';
import { toPersianDigits } from '@/shared/lib/jalali';
import { wrapIndex, type LightboxPhotoRef } from '../lib/chatPhotoUrls';
import { rotateBy, stepZoom } from '../lib/lightboxTransform';

export interface ChatPhotoLightboxProps {
  photos: LightboxPhotoRef[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/**
 * Photo viewer for project chat frames. Native <dialog> (modal) so Esc closes it.
 * Arrow keys: ArrowRight = previous, ArrowLeft = next (matches the RTL chevrons on screen).
 * Photo URLs are presigned S3 links used directly, never proxied.
 */
export function ChatPhotoLightbox({ photos, index, onClose, onIndexChange }: ChatPhotoLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const total = photos.length;
  const current = photos[index];
  const hasMany = total > 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  // Reset transform whenever the shown photo changes.
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [index]);

  const goTo = (step: number) => {
    if (total === 0) return;
    onIndexChange(wrapIndex(index, step, total));
  };

  if (!current) return null;

  const toolbarBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60';

  return (
    <dialog
      ref={dialogRef}
      data-testid="chat-photo-lightbox"
      aria-label={current.name}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' && hasMany) {
          e.preventDefault();
          goTo(-1);
        } else if (e.key === 'ArrowLeft' && hasMany) {
          e.preventDefault();
          goTo(1);
        }
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/80"
    >
      <div className="relative flex h-full w-full flex-col items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن"
          className="absolute start-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
        >
          <MzIcon name="close" size={20} />
        </button>

        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center px-16">
          {hasMany && (
            <button
              type="button"
              onClick={() => goTo(-1)}
              aria-label="تصویر قبلی"
              className="absolute start-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
            >
              <MzIcon name="chevron_right" size={22} />
            </button>
          )}

          <img
            src={current.url}
            alt={current.name}
            loading="eager"
            className="max-h-[70vh] max-w-full select-none object-contain transition-transform duration-150"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />

          {hasMany && (
            <button
              type="button"
              onClick={() => goTo(1)}
              aria-label="تصویر بعدی"
              className="absolute end-3 top-1/2 z-10 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
            >
              <MzIcon name="chevron_right" size={22} className="icon-flip-horizontal" />
            </button>
          )}
        </div>

        <div className="mt-3 rounded-full bg-black/60 px-4 py-1 text-[12px] text-white">
          {current.name}
          {hasMany && (
            <span className="ms-2 text-white/70">
              {toPersianDigits(index + 1)} / {toPersianDigits(total)}
            </span>
          )}
        </div>

        {hasMany && (
          <div className="mt-3 flex max-w-full gap-2 overflow-x-auto px-4 pb-1">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={photo.name}
                aria-current={i === index ? 'true' : undefined}
                className={`h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 ${
                  i === index ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="mb-4 mt-3 flex items-center gap-1 rounded-2xl bg-black/70 px-2 py-1.5">
          <a
            href={current.url}
            download={current.name}
            aria-label="دانلود"
            className={toolbarBtn}
          >
            <MzIcon name="download" size={18} />
          </a>
          <button type="button" aria-label="چرخش به چپ" className={toolbarBtn} onClick={() => setRotation((r) => rotateBy(r, -90))}>
            <MzIcon name="rotate_left" size={18} />
          </button>
          <button type="button" aria-label="چرخش به راست" className={toolbarBtn} onClick={() => setRotation((r) => rotateBy(r, 90))}>
            <MzIcon name="rotate_right" size={18} />
          </button>
          <button type="button" aria-label="کوچک‌نمایی" className={toolbarBtn} onClick={() => setZoom((z) => stepZoom(z, -1))}>
            <MzIcon name="zoom_out" size={18} />
          </button>
          <button type="button" aria-label="بزرگ‌نمایی" className={toolbarBtn} onClick={() => setZoom((z) => stepZoom(z, 1))}>
            <MzIcon name="zoom_in" size={18} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
