import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ChevronUp, Loader2, MessageSquare } from 'lucide-react';
import { dateToJalali, PERSIAN_MONTH_NAMES, toPersianDigits } from '@/shared/lib/jalali';
import type { ProjectPhotoItem, StreamItem } from '../types';
import { StreamChatMessageCard } from './cards/StreamChatMessageCard';
import { StreamTaskActivityCard } from './cards/StreamTaskActivityCard';
import { StreamPhotoBubbleCard } from './cards/StreamPhotoBubbleCard';
import { StreamDocumentCard } from './cards/StreamDocumentCard';
import { StreamMeetingMinutesCard } from './cards/StreamMeetingMinutesCard';

export interface ProjectStreamListProps {
  projectId: string;
  items: StreamItem[];
  lastReadAt?: string | null;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  /** Project room refused with 403: show the permission message instead of the empty state. */
  accessDenied?: boolean;
  onLoadMore?: () => void;
  onReply: (item: StreamItem) => void;
  onReact: (item: StreamItem, emoji: string) => void;
  onEdit?: (item: StreamItem, nextText: string) => void;
  onDelete?: (item: StreamItem) => void;
  canDeleteAny?: boolean;
  onOpenTask?: (taskId: string) => void;
  onOpenPhoto?: (photos: ProjectPhotoItem[], index: number) => void;
  replyCountsByItemId?: Record<string, number>;
  currentUserId?: string | null;
}

const JS_WEEKDAY_TO_PERSIAN = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
  'شنبه',
] as const;

function getLocalDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatJalaliDateLabel(iso: string, nowDate: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const { jy, jm, jd } = dateToJalali(d);
  const nowJalali = dateToJalali(nowDate);
  const weekday = JS_WEEKDAY_TO_PERSIAN[d.getDay()] ?? '';
  const monthName = PERSIAN_MONTH_NAMES[jm - 1] ?? '';
  const base =
    jy !== nowJalali.jy
      ? `${weekday} ${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`
      : `${weekday} ${toPersianDigits(jd)} ${monthName}`;

  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const diffDays = Math.round((nStart - dStart) / 86_400_000);

  if (diffDays === 0) return `${base} (امروز)`;
  if (diffDays === 1) return `${base} (دیروز)`;
  if (diffDays > 1 && diffDays < 30) return `${base} (${toPersianDigits(diffDays)} روز قبل)`;
  if (diffDays >= 30 && diffDays < 60) return `${base} (یک ماه قبل)`;
  if (diffDays >= 60 && diffDays < 365) {
    return `${base} (${toPersianDigits(Math.floor(diffDays / 30))} ماه قبل)`;
  }
  return base;
}

/** Distance from the top (px) at which older history loads automatically. */
export const AUTO_LOAD_TOP_PX = 120;

/**
 * scrollTop that keeps the same visible content in place after older rows are prepended:
 * the height gained above the viewport is added to the previous scrollTop.
 */
export function scrollTopAfterPrepend(
  prevScrollTop: number,
  prevScrollHeight: number,
  nextScrollHeight: number,
): number {
  return prevScrollTop + (nextScrollHeight - prevScrollHeight);
}

/** Auto-load only when older history exists, a handler is wired, nothing is in flight and the reader is near the top. */
export function shouldAutoLoadOlder(input: {
  scrollTop: number;
  hasMore: boolean;
  loadingMore: boolean;
  hasHandler: boolean;
}): boolean {
  return (
    input.hasMore &&
    input.hasHandler &&
    !input.loadingMore &&
    input.scrollTop <= AUTO_LOAD_TOP_PX
  );
}

export function ProjectStreamList({
  projectId,
  items,
  lastReadAt,
  loading = false,
  loadingMore = false,
  hasMore = false,
  accessDenied = false,
  onLoadMore,
  onReply,
  onReact,
  onEdit,
  onDelete,
  canDeleteAny,
  onOpenTask,
  onOpenPhoto,
  replyCountsByItemId,
  currentUserId,
}: ProjectStreamListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const prevLastIdRef = useRef<string | null>(null);
  // True while the reader sits at the bottom; late-loading images then keep the feed pinned to the latest.
  const stickRef = useRef(true);
  // One older-history request in flight at a time (manual button and auto-load share it).
  const olderInFlightRef = useRef(false);
  // Scroll geometry captured right before an older-history request, restored after prepend.
  const prependSnapRef = useRef<{ top: number; height: number } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const canLoadOlder = hasMore && Boolean(onLoadMore);

  const triggerLoadOlder = useCallback(() => {
    if (!onLoadMore || !hasMore || loadingMore || olderInFlightRef.current) return;
    olderInFlightRef.current = true;
    const el = scrollRef.current;
    prependSnapRef.current = el ? { top: el.scrollTop, height: el.scrollHeight } : null;
    onLoadMore();
  }, [onLoadMore, hasMore, loadingMore]);

  useEffect(() => {
    if (!loadingMore) olderInFlightRef.current = false;
  }, [loadingMore]);

  // Keep the reader's position when older rows are prepended above the viewport.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const snap = prependSnapRef.current;
    if (!el || !snap || loadingMore) return;
    prependSnapRef.current = null;
    if (el.scrollHeight > snap.height) {
      el.scrollTop = scrollTopAfterPrepend(snap.top, snap.height, el.scrollHeight);
    }
  }, [items, loadingMore]);

  // Auto-load when the sentinel above the first item enters the top zone of the scroll container.
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (
          shouldAutoLoadOlder({
            scrollTop: root.scrollTop,
            hasMore,
            loadingMore,
            hasHandler: Boolean(onLoadMore),
          })
        ) {
          triggerLoadOlder();
        }
      },
      { root, rootMargin: `${AUTO_LOAD_TOP_PX}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, triggerLoadOlder, canLoadOlder]);

  const itemsById = useMemo(() => {
    const map = new Map<string, StreamItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const firstUnreadItemId = useMemo(() => {
    if (!lastReadAt) return null;
    const readMs = Date.parse(lastReadAt);
    if (Number.isNaN(readMs)) return null;
    for (const item of items) {
      if (item.isCurrentUser) continue;
      const itemMs = Date.parse(item.createdAt);
      if (!Number.isNaN(itemMs) && itemMs > readMs) {
        return item.id;
      }
    }
    return null;
  }, [items, lastReadAt]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const lastItem = items[items.length - 1];
    const lastId = lastItem?.id ?? null;
    const initialLoad = prevCountRef.current === 0 && items.length > 0;
    const appendedAtEnd =
      items.length > prevCountRef.current &&
      lastId !== null &&
      lastId !== prevLastIdRef.current;

    if (initialLoad || (appendedAtEnd && lastItem?.isCurrentUser)) {
      stickRef.current = true;
      el.scrollTop = el.scrollHeight;
    } else if (appendedAtEnd) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 180) {
        el.scrollTop = el.scrollHeight;
      }
    }

    prevCountRef.current = items.length;
    prevLastIdRef.current = lastId;
  }, [items]);

  let lastDayKey: string | null = null;

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const t = e.currentTarget;
        stickRef.current = t.scrollHeight - t.scrollTop - t.clientHeight < 180;
      }}
      onLoadCapture={(e) => {
        const t = scrollRef.current;
        if (t && stickRef.current && e.target instanceof HTMLImageElement) t.scrollTop = t.scrollHeight;
      }}
      className="mz-scroll-area flex-1 px-4 py-4 sm:px-6"
      data-testid="project-stream-list"
    >
      {canLoadOlder && <div ref={sentinelRef} aria-hidden="true" data-testid="stream-older-sentinel" className="h-px" />}

      {canLoadOlder && (
        <div className="mb-3 flex justify-center">
          <button
            type="button"
            onClick={triggerLoadOlder}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#e0e0e0] bg-[#f5f6f8] px-4 py-1 text-[12px] font-medium text-[#3078ab] transition-colors hover:bg-[#e8f2fa] disabled:opacity-50"
          >
            {loadingMore ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ChevronUp size={14} />
            )}
            <span>بارگذاری پیام‌های قدیمی‌تر</span>
          </button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div
          className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-[#909090]"
          data-testid="stream-loading"
        >
          <Loader2 size={24} className="animate-spin text-[#3078ab]" />
          <span className="text-[12.5px]">در حال بارگذاری جریان پروژه...</span>
        </div>
      ) : items.length === 0 && accessDenied ? (
        <div
          className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-[#909090]"
          data-testid="stream-access-denied"
        >
          <MessageSquare size={28} className="text-[#d5d8dc]" />
          <span className="text-[13px]">شما اجازهٔ مشاهدهٔ گفتگوی این پروژه را ندارید. با مدیر پروژه تماس بگیرید.</span>
        </div>
      ) : items.length === 0 ? (
        <div
          className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-[#909090]"
          data-testid="stream-empty"
        >
          <MessageSquare size={28} className="text-[#d5d8dc]" />
          <span className="text-[13px]">هنوز پیامی در این گروه ثبت نشده است.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const d = new Date(item.createdAt);
            const dayKey = Number.isNaN(d.getTime()) ? item.createdAt.slice(0, 10) : getLocalDayKey(d);
            const showDateHeader = dayKey !== lastDayKey;
            lastDayKey = dayKey;
            const showUnreadBar = firstUnreadItemId === item.id;
            const replyTarget = item.replyTo?.id ? itemsById.get(item.replyTo.id) ?? null : null;
            const replyCount =
              replyCountsByItemId?.[item.id] ?? item.rawTaskActivity?.replyCount ?? 0;

            return (
              <div key={item.id} className="space-y-2.5">
                {showDateHeader && (
                  <div className="my-2 flex justify-center" data-testid={`stream-date-${dayKey}`}>
                    <span className="rounded-full bg-[#f5f6f8] px-3.5 py-0.5 text-[11.5px] font-medium text-[#6b7280]">
                      {formatJalaliDateLabel(item.createdAt)}
                    </span>
                  </div>
                )}

                {showUnreadBar && (
                  <div
                    className="mz-unread-bar my-2"
                    role="separator"
                    data-testid="stream-unread-bar"
                  >
                    پیام‌های جدید
                  </div>
                )}

                {item.kind === 'chat' && (
                  <StreamChatMessageCard
                    item={item}
                    replyTarget={replyTarget}
                    onReply={onReply}
                    onReact={onReact}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    canDeleteAny={canDeleteAny}
                    onOpenTask={onOpenTask}
                    currentUserId={currentUserId}
                  />
                )}

                {item.kind === 'task_activity' && (
                  <StreamTaskActivityCard
                    item={item}
                    onReply={onReply}
                    onReact={onReact}
                    onOpenTask={onOpenTask}
                    currentUserId={currentUserId}
                  />
                )}

                {item.kind === 'photo' && (
                  <StreamPhotoBubbleCard
                    item={item}
                    replyCount={replyCount}
                    onReply={onReply}
                    onReact={onReact}
                    onOpenPhoto={onOpenPhoto}
                    currentUserId={currentUserId}
                  />
                )}

                {item.kind === 'document' && (
                  <StreamDocumentCard
                    item={item}
                    projectId={projectId}
                    onReply={onReply}
                    onReact={onReact}
                    currentUserId={currentUserId}
                  />
                )}

                {item.kind === 'minutes' && (
                  <StreamMeetingMinutesCard
                    item={item}
                    onReply={onReply}
                    onReact={onReact}
                    currentUserId={currentUserId}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
