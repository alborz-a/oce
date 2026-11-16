import type { ProjectTaskItem } from './types';

const SYNTHETIC_ALBUM_TITLE_PREFIX = 'تعیین موضوع عکس ها';

/**
 * True for the synthetic Mizito album tasks (title «تعیین موضوع عکس‌ها — <jalali date>»).
 * ZWNJ (U+200C) is normalized to a plain space so both spellings match.
 */
export function isSyntheticAlbumTask(task: Pick<ProjectTaskItem, 'title'>): boolean {
  const title = (task.title ?? '').replace(/‌/g, ' ').trim();
  return title.startsWith(SYNTHETIC_ALBUM_TITLE_PREFIX);
}
