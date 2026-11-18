import { useState, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { MzIcon } from '../MzIcon';
import { toPersianDigits } from '@/shared/lib/jalali';
import type { StreamItem, StreamReactionMap } from '../../types';
import { useOpenDmForColleague } from '../../context/WorkspaceDmContext';
import { extractImageUrls, isBareImageUrlMessage } from '../../lib/chatPhotoUrls';
import type { RawFileChip } from '../../lib/rawFileTag';
import { extractChatEvents } from '../../lib/chatEventLine';
import { rawFileQuotePreview } from '../../lib/rawFileTag';
import { apiGet } from '@/shared/lib/api';
import { useQuery } from '@tanstack/react-query';
import { ChatPhotoLightbox } from '../ChatPhotoLightbox';

const RAW_IMAGE_RE = /\.(jpe?g|png|gif|heic|jfif|webp)$/i;

interface ChatFileUrlResponse {
  url: string | null;
}

function chatFileUrlPath(key: string): string {
  return `/v1/documents/chat-file-url/?key=${encodeURIComponent(key)}`;
}

/** Download an imported chat file: the blank tab is opened first so the popup blocker allows it. */
async function openChatFile(key: string): Promise<void> {
  const win = window.open('', '_blank');
  if (win) win.opener = null;
  try {
    const res = await apiGet<ChatFileUrlResponse>(chatFileUrlPath(key));
    if (res.url && win) win.location.href = res.url;
    else win?.close();
  } catch {
    win?.close();
  }
}

/** One unresolved `[فایل: …]` entity: framed photo for image extensions, file chip otherwise. */
function RawFileEntity({ file }: { file: RawFileChip }) {
  const [open, setOpen] = useState(false);
  const key = file.key;
  const isImage = Boolean(key) && RAW_IMAGE_RE.test(file.name.trim());
  const { data } = useQuery({
    queryKey: ['chat-file-url', key],
    queryFn: () => apiGet<ChatFileUrlResponse>(chatFileUrlPath(key ?? '')),
    enabled: isImage && Boolean(key),
    staleTime: 0,
  });
  const imageUrl = data?.url ?? null;

  if (isImage && key) {
    return (
      <>
        <button
          type="button"
          className="im-entity-photo"
          onClick={() => setOpen(true)}
          disabled={!imageUrl}
          aria-label={file.name}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={file.name} loading="lazy" />
          ) : (
            <MzIcon name="image" size={28} />
          )}
        </button>
        {open && imageUrl && (
          <ChatPhotoLightbox
            photos={[{ id: key, url: imageUrl, name: file.name }]}
            index={0}
            onClose={() => setOpen(false)}
            onIndexChange={() => undefined}
          />
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      disabled={!key}
      onClick={() => {
        if (key) void openChatFile(key);
      }}
      className="flex max-w-full items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 py-1.5 text-start text-[13px] text-black/85 disabled:cursor-default"
    >
      <MzIcon name={file.icon} size={18} />
      <span className="min-w-0 truncate">{file.name}</span>
    </button>
  );
}

/** File entities for unresolved `[فایل: …]` chat tags. */
function RawFileChips({ files }: { files?: RawFileChip[] }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="mb-1 flex flex-col gap-1">
      {files.map((file, idx) => (
        <RawFileEntity key={`${file.name}-${idx}`} file={file} />
      ))}
    </div>
  );
}

export const QUICK_REACTIONS = ['👍', '❤️', '🎉', '👏', '👀', '✅'] as const;

export function formatStreamTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return toPersianDigits(`${hh}:${mm}`);
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '؟';
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2 && parts[0]?.[0] && parts[1]?.[0]) {
    return `${parts[0][0]}${parts[1][0]}`;
  }
  return cleaned.slice(0, 2);
}

export interface StreamCardFooterBarProps {
  item: StreamItem;
  onReply: (item: StreamItem) => void;
  onReact: (item: StreamItem, emoji: string) => void;
  replyCount?: number;
  currentUserId?: string | null;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  showCommentLabel?: boolean;
  align?: 'start' | 'end' | 'center';
}

export function StreamCardFooterBar({
  item,
  onReply,
  onReact,
  replyCount = 0,
  currentUserId,
  onEditClick,
  onDeleteClick,
  showCommentLabel = false,
  align = 'start',
}: StreamCardFooterBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactions: StreamReactionMap = item.reactions ?? {};
  const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);
  const justifyCls =
    align === 'center' ? 'justify-center' : align === 'end' ? 'justify-end' : 'justify-start';

  return (
    <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${justifyCls}`}>
      {reactionEntries.map(([emoji, users]) => {
        const reacted = Boolean(currentUserId && users.includes(currentUserId));
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(item, emoji)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              reacted
                ? 'border-[#3078ab] bg-[#3078ab]/10 text-[#3078ab]'
                : 'border-[#e0e0e0] bg-white text-black/75 hover:border-[#3078ab]/60'
            }`}
            aria-label={`واکنش ${emoji} (${toPersianDigits(users.length)})`}
          >
            <span>{emoji}</span>
            <span>{toPersianDigits(users.length)}</span>
          </button>
        );
      })}

      <div className="relative inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onReply(item)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-[#6b7280] transition-colors hover:bg-black/5 hover:text-[#3078ab]"
          aria-label="پاسخ"
        >
          <MzIcon name="reply" size={12} />
          <span>پاسخ</span>
        </button>

        {showCommentLabel && (
          <button
            type="button"
            onClick={() => onReply(item)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-[#6b7280] transition-colors hover:bg-black/5 hover:text-[#3078ab]"
            aria-label="نظر"
          >
            <span>
              {replyCount > 0 ? `${toPersianDigits(replyCount)} نظر` : 'نظر'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-[#6b7280] transition-colors hover:bg-black/5 hover:text-[#3078ab]"
          aria-label="واکنش"
          aria-expanded={pickerOpen}
        >
          <MzIcon name="insert_emoticon" size={12} />
          <span>واکنش</span>
        </button>

        {onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-[#6b7280] transition-colors hover:bg-black/5 hover:text-[#3078ab]"
            aria-label="ویرایش"
          >
            <MzIcon name="edit" size={11} />
            <span>ویرایش</span>
          </button>
        )}

        {onDeleteClick && (
          <button
            type="button"
            onClick={onDeleteClick}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-[#d9534f] transition-colors hover:bg-black/5"
            aria-label="حذف"
            data-testid="stream-chat-delete"
          >
            <Trash2 size={11} />
            <span>حذف</span>
          </button>
        )}

        {pickerOpen && (
          <div
            role="menu"
            aria-label="انتخاب واکنش"
            className="absolute bottom-full start-0 z-20 mb-1 flex items-center gap-1 rounded-full border border-[#e0e0e0] bg-white px-2 py-1 shadow-md"
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                onClick={() => {
                  onReact(item, emoji);
                  setPickerOpen(false);
                }}
                className="rounded-full p-1 text-[14px] leading-none transition-transform hover:scale-110 hover:bg-[#f2f4f7]"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export interface StreamChatMessageCardProps {
  item: StreamItem;
  replyTarget?: StreamItem | null;
  onReply: (item: StreamItem) => void;
  onReact: (item: StreamItem, emoji: string) => void;
  onEdit?: (item: StreamItem, nextText: string) => void;
  onDelete?: (item: StreamItem) => void;
  canDeleteAny?: boolean;
  onOpenTask?: (taskId: string) => void;
  currentUserId?: string | null;
}

/** Photo frame for an image URL found in message text; falls back to the plain link if the image fails. */
function ImageUrlFrame({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-[12px] text-[#3078ab] underline"
      >
        {url}
      </a>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="block aspect-[4/3] w-[260px] max-w-full rounded-[6px] bg-[#f2f4f7] object-cover shadow-md"
    />
  );
}

function ImageUrlFrames({ text }: { text: string | null | undefined }) {
  const urls = extractImageUrls(text);
  if (urls.length === 0) return null;
  return (
    <div className="mb-1.5 space-y-1.5">
      {urls.map((url) => (
        <ImageUrlFrame key={url} url={url} />
      ))}
    </div>
  );
}

export function StreamChatMessageCard({
  item,
  replyTarget,
  onReply,
  onReact,
  onEdit,
  onDelete,
  canDeleteAny = false,
  onOpenTask,
  currentUserId,
}: StreamChatMessageCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text ?? '');
  const openDm = useOpenDmForColleague(currentUserId);
  const senderId = item.authorId && item.authorId !== currentUserId ? item.authorId : null;
  const senderClickProps = senderId
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': `گفتگوی مستقیم با ${item.authorName}`,
        onClick: () => void openDm(senderId),
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void openDm(senderId);
          }
        },
      }
    : {};
  const timeText = formatStreamTime(item.createdAt);
  const isEdited = Boolean(item.rawChatMessage?.edited_at);

  const quoteAuthor = replyTarget?.authorName || item.replyTo?.authorName || item.quotedEntity?.title || '';
  const quoteText = rawFileQuotePreview(
    replyTarget?.text || item.replyTo?.text || item.quotedEntity?.subtitle || '',
  );
  const quotedTaskId =
    item.quotedEntity?.kind === 'task_activity'
      ? item.quotedEntity.id
      : replyTarget?.rawTaskActivity?.taskId;

  const handleSaveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || !onEdit) {
      setEditing(false);
      return;
    }
    onEdit(item, trimmed);
    setEditing(false);
  };

  const eventInfo = extractChatEvents(item.text);
  const bodyText = eventInfo.labels.length > 0 ? eventInfo.rest : (item.text ?? '');
  const eventPills =
    eventInfo.labels.length > 0 ? (
      <div className="relative mb-2 mt-[31px] w-full" data-testid={`stream-event-${item.id}`}>
        <div className="meeting-system-message">
          {eventInfo.labels.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>
      </div>
    ) : null;
  if (eventPills && !bodyText) return eventPills;

  return (
    <>
    {eventPills}
    <article
      className={`group flex w-full items-end gap-2 ${
        item.isCurrentUser ? 'chat-item-right justify-start' : 'chat-item-left justify-end'
      }`}
      data-testid={`stream-card-chat-${item.id}`}
    >
      {!item.isCurrentUser && (
        <div className="flex max-w-[min(78%,640px)] flex-col items-end">
          {item.authorName && (
            <span
              className={`chat-item-sender-name mb-1 px-1 ${senderId ? 'cursor-pointer hover:underline' : ''}`}
              data-testid={`stream-sender-${item.id}`}
              {...senderClickProps}
            >
              {item.authorName}
            </span>
          )}
          <div className="chat-item-body px-3.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
            {(quoteAuthor || quoteText) && (
              <div
                onClick={() => {
                  if (quotedTaskId && onOpenTask) onOpenTask(quotedTaskId);
                }}
                className={`mb-1.5 rounded border-s-2 border-[#3078ab] bg-black/[0.04] px-2.5 py-1 text-[11.5px] ${
                  quotedTaskId && onOpenTask ? 'cursor-pointer hover:bg-black/[0.07]' : ''
                }`}
              >
                {quoteAuthor && (
                  <div className="font-semibold text-[#3078ab]">{quoteAuthor}</div>
                )}
                {quoteText && (
                  <div className="line-clamp-2 text-black/70">{quoteText}</div>
                )}
              </div>
            )}

            <RawFileChips files={item.rawFiles} />
            <ImageUrlFrames text={bodyText} />
            {!isBareImageUrlMessage(bodyText) && (
              <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-black/85">
                {bodyText}
              </p>
            )}

            <div className="mt-1 flex items-center justify-end gap-1.5">
              {isEdited && (
                <span className="mz-time-muted">ویرایش‌شده</span>
              )}
              {timeText && <span className="mz-time-muted">{timeText}</span>}
            </div>
          </div>

          <StreamCardFooterBar
            item={item}
            onReply={onReply}
            onReact={onReact}
            currentUserId={currentUserId}
            align="end"
          />
        </div>
      )}

      {!item.isCurrentUser && (
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3078ab]/15 text-[11px] font-semibold text-[#3078ab] ${senderId ? 'cursor-pointer' : ''}`}
          data-testid={`stream-avatar-${item.id}`}
          {...(senderId ? senderClickProps : { 'aria-hidden': true })}
        >
          {getInitials(item.authorName)}
        </div>
      )}

      {item.isCurrentUser && (
        <div className="flex max-w-[min(78%,640px)] flex-col items-start">
          <div className="chat-item-body px-3.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
            {(quoteAuthor || quoteText) && (
              <div
                onClick={() => {
                  if (quotedTaskId && onOpenTask) onOpenTask(quotedTaskId);
                }}
                className={`mb-1.5 rounded border-s-2 border-[#3078ab] bg-black/[0.05] px-2.5 py-1 text-[11.5px] ${
                  quotedTaskId && onOpenTask ? 'cursor-pointer hover:bg-black/[0.08]' : ''
                }`}
              >
                {quoteAuthor && (
                  <div className="font-semibold text-[#3078ab]">{quoteAuthor}</div>
                )}
                {quoteText && (
                  <div className="line-clamp-2 text-black/70">{quoteText}</div>
                )}
              </div>
            )}

            {editing ? (
              <div className="min-w-[220px] space-y-1.5">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  aria-label="متن ویرایش پیام"
                  className="w-full rounded border border-[#3078ab]/50 bg-white px-2 py-1 text-[13px] text-black/85 focus:outline-none focus:ring-1 focus:ring-[#3078ab]"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(item.text ?? '');
                      setEditing(false);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-[#e0e0e0] bg-white px-2 py-0.5 text-[11px] text-black/70 hover:bg-[#f5f6f8]"
                  >
                    <MzIcon name="close" size={11} />
                    <span>انصراف</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-1 rounded bg-[#3078ab] px-2.5 py-0.5 text-[11px] font-medium text-white hover:brightness-95"
                  >
                    <MzIcon name="check" size={11} />
                    <span>ذخیره</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <RawFileChips files={item.rawFiles} />
                <ImageUrlFrames text={bodyText} />
                {!isBareImageUrlMessage(bodyText) && (
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-black/85">
                    {bodyText}
                  </p>
                )}
              </>
            )}

            <div className="mt-1 flex items-center justify-end gap-1.5">
              {isEdited && (
                <span className="mz-time-muted">ویرایش‌شده</span>
              )}
              {timeText && <span className="mz-time-muted">{timeText}</span>}
            </div>
          </div>

          <StreamCardFooterBar
            item={item}
            onReply={onReply}
            onReact={onReact}
            currentUserId={currentUserId}
            onEditClick={
              onEdit && !editing
                ? () => {
                    setDraft(item.text ?? '');
                    setEditing(true);
                  }
                : undefined
            }
            onDeleteClick={
              onDelete && (item.isCurrentUser || canDeleteAny) && !editing
                ? () => {
                    if (window.confirm('این پیام حذف شود؟')) onDelete(item);
                  }
                : undefined
            }
            align="start"
          />
        </div>
      )}
    </article>
    </>
  );
}
