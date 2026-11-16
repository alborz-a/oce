import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { AuthImage } from '@/shared/ui';
import { MediaLightbox, type MediaLightboxItem } from '@/features/file-manager/components/MediaLightbox';
import { toPersianDigits } from '@/shared/lib/jalali';
import type { ProjectPhotoItem, StreamItem } from '../../types';
import { formatStreamTime, getInitials, StreamCardFooterBar } from './StreamChatMessageCard';

export interface StreamPhotoBubbleCardProps {
  item: StreamItem;
  replyCount?: number;
  onReply: (item: StreamItem) => void;
  onReact: (item: StreamItem, emoji: string) => void;
  onOpenPhoto?: (photos: ProjectPhotoItem[], index: number) => void;
  currentUserId?: string | null;
}

function getThumbUrl(photo: ProjectPhotoItem): string {
  return (
    photo.thumbnail_url ||
    photo.preview_url ||
    photo.download_url ||
    `/api/v1/documents/photos/${photo.id}/thumb/`
  );
}

function getFullFileUrl(photo: ProjectPhotoItem): string {
  return (
    photo.download_url ||
    photo.preview_url ||
    `/api/v1/documents/photos/${photo.id}/file/`
  );
}

export function StreamPhotoBubbleCard({
  item,
  replyCount = 0,
  onReply,
  onReact,
  onOpenPhoto,
  currentUserId,
}: StreamPhotoBubbleCardProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const photos = item.rawPhotos ?? [];
  const visiblePhotos = photos.slice(0, 4);
  const extraCount = Math.max(0, photos.length - visiblePhotos.length);
  const sharedCaption =
    item.text?.trim() ||
    photos.find((p) => Boolean(p.caption?.trim()))?.caption?.trim() ||
    '';
  const timeText = formatStreamTime(item.createdAt);

  const handlePhotoClick = (index: number) => {
    if (onOpenPhoto) {
      onOpenPhoto(photos, index);
      return;
    }
    setLightboxIdx(index);
  };

  const lightboxItems: MediaLightboxItem[] =
    lightboxIdx !== null
      ? photos.map((p) => ({
          id: p.id,
          name: p.caption || p.filename || 'تصویر پروژه',
          extension: p.filename?.split('.').pop() ?? 'jpg',
          mime_type: 'image/jpeg',
          download_url: getFullFileUrl(p),
          thumbnail_url: getThumbUrl(p),
          kind: 'photo',
        }))
      : [];

  return (
    <article
      className={`group flex w-full items-end gap-2 ${
        item.isCurrentUser ? 'chat-item-right justify-start' : 'chat-item-left justify-end'
      }`}
      data-testid={`stream-card-photo-${item.id}`}
    >
      <div className={`flex max-w-[310px] flex-col ${item.isCurrentUser ? 'items-start' : 'items-end'}`}>
        {!item.isCurrentUser && item.authorName && (
          <span className="chat-item-sender-name mb-1 px-1">{item.authorName}</span>
        )}

        <div className="w-[270px] max-w-full overflow-hidden rounded-[8px] border border-[#e0e0e0] bg-white p-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
          <div className="space-y-1.5">
            {visiblePhotos.map((photo, idx) => {
              const isOverflowTile = idx === visiblePhotos.length - 1 && extraCount > 0;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handlePhotoClick(idx)}
                  className="relative block w-full overflow-hidden rounded-[6px] bg-[#f2f4f7] text-start focus:outline-none focus:ring-2 focus:ring-[#3078ab]"
                  aria-label={photo.caption || photo.filename || 'مشاهده تصویر'}
                >
                  <AuthImage
                    src={getThumbUrl(photo)}
                    alt={photo.caption || photo.filename || 'تصویر پروژه'}
                    className="mz-media-block h-auto max-h-[260px] w-full object-cover"
                    placeholder={
                      <div className="flex h-40 w-full items-center justify-center bg-[#f2f4f7] text-[#909090]">
                        <ImageIcon size={24} />
                      </div>
                    }
                    fallback={
                      <div className="flex h-36 w-full flex-col items-center justify-center gap-1 bg-[#f5f6f8] text-[11px] text-[#909090]">
                        <ImageIcon size={22} />
                        <span>پیش‌نمایش در دسترس نیست</span>
                      </div>
                    }
                  />
                  {isOverflowTile && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-base font-bold text-white">
                      +{toPersianDigits(extraCount)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {(sharedCaption || timeText) && (
            <div className="mt-1.5 flex items-end justify-between gap-2 px-1 pb-0.5">
              {sharedCaption ? (
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[12.5px] leading-snug text-black/85">
                  {sharedCaption}
                </p>
              ) : (
                <span />
              )}
              {timeText && <span className="mz-time-muted shrink-0">{timeText}</span>}
            </div>
          )}
        </div>

        <StreamCardFooterBar
          item={item}
          onReply={onReply}
          onReact={onReact}
          replyCount={replyCount}
          currentUserId={currentUserId}
          showCommentLabel
          align={item.isCurrentUser ? 'start' : 'end'}
        />
      </div>

      {!item.isCurrentUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3078ab]/15 text-[11px] font-semibold text-[#3078ab]"
          aria-hidden="true"
        >
          {getInitials(item.authorName)}
        </div>
      )}

      {!onOpenPhoto && lightboxIdx !== null && lightboxItems.length > 0 && (
        <MediaLightbox
          open
          items={lightboxItems}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onIndexChange={setLightboxIdx}
        />
      )}
    </article>
  );
}
