import { useState } from 'react';
import { MzIcon } from '../MzIcon';
import { FileDown, Loader2 } from 'lucide-react';
import { downloadWithAuth } from '@/shared/lib/api';
import { toPersianDigits } from '@/shared/lib/jalali';
import type { StreamItem } from '../../types';
import { parseRawFileTags } from '../../lib/rawFileTag';
import { formatStreamTime, getInitials, StreamCardFooterBar } from './StreamChatMessageCard';

export interface StreamDocumentCardProps {
  item: StreamItem;
  projectId: string;
  onReply: (item: StreamItem) => void;
  onReact: (item: StreamItem, emoji: string) => void;
  currentUserId?: string | null;
}

export function formatDocumentSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '۰ KB';
  if (bytes < 1024) return `${toPersianDigits(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${toPersianDigits(Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${toPersianDigits(mb.toFixed(1))} MB`;
}

export function StreamDocumentCard({
  item,
  projectId,
  onReply,
  onReact,
  currentUserId,
}: StreamDocumentCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const doc = item.rawDocument;
  const captionText = parseRawFileTags(item.text ?? '').text.trim();
  const fileName = doc?.name || captionText || 'فایل پروژه';
  const fileSize = doc?.file_size ?? doc?.size_bytes ?? 0;
  const ext = (doc?.extension || fileName.split('.').pop() || '').toUpperCase().slice(0, 5);
  const caption =
    captionText && captionText !== fileName.trim()
      ? captionText
      : doc?.description?.trim() || '';
  const downloadUrl =
    doc?.download_url || (doc?.id ? `/api/v1/documents/${doc.id}/download/` : '');
  const timeText = formatStreamTime(item.createdAt);

  const handleDownload = async () => {
    if (!downloadUrl || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadWithAuth(downloadUrl, fileName);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'خطا در دانلود فایل');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      className={`group flex w-full items-end gap-2 ${
        item.isCurrentUser ? 'chat-item-right justify-start' : 'chat-item-left justify-end'
      }`}
      data-testid={`stream-card-doc-${item.id}`}
      data-project-id={projectId}
    >
      <div className={`flex max-w-[330px] flex-col ${item.isCurrentUser ? 'items-start' : 'items-end'}`}>
        {!item.isCurrentUser && item.authorName && (
          <span className="chat-item-sender-name mb-1 px-1">{item.authorName}</span>
        )}

        <div className="w-[300px] max-w-full rounded-[10px] border border-[#e0e0e0] bg-white px-3.5 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
          {caption && (
            <p className="mb-2 border-b border-[#f2f4f7] pb-1.5 text-[12.5px] font-medium text-black/85">
              {caption}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-end">
              <div
                dir="auto"
                className="truncate text-[13px] font-semibold text-black/85"
                title={fileName}
              >
                {fileName}
              </div>
              <div className="mt-0.5 text-[11.5px] font-medium text-[#00b4d8]">
                حجم فایل: {formatDocumentSize(fileSize)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleDownload();
              }}
              disabled={!downloadUrl || downloading}
              aria-label={`دانلود ${fileName}`}
              className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#f5f6f8] text-[#3078ab] transition-colors hover:bg-[#e8f2fa] disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : downloadUrl ? (
                <FileDown size={20} />
              ) : (
                <MzIcon name="description" size={18} />
              )}
              {ext && !downloading && (
                <span className="mt-0.5 text-[8.5px] font-bold leading-none text-[#757575]">
                  {ext}
                </span>
              )}
            </button>
          </div>

          {downloadError && (
            <p className="mt-1.5 text-[11px] text-[#d9534f]" role="alert">
              {downloadError}
            </p>
          )}

          {timeText && (
            <div className="mt-1 flex justify-end">
              <span className="mz-time-muted">{timeText}</span>
            </div>
          )}
        </div>

        <StreamCardFooterBar
          item={item}
          onReply={onReply}
          onReact={onReact}
          currentUserId={currentUserId}
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
    </article>
  );
}
