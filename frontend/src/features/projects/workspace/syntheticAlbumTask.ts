import type { ProjectTaskItem } from './types';

const SYNTHETIC_ALBUM_TITLE_PREFIX = 'تعیین موضوع عکس ها';

/**
 * True for the synthetic Mizito album tasks (title «تعیین موضوع عکس‌ها — <jalali date>»).
 * ZWNJ (U+200C) is normalized to a plain space so both spellings match.
 * Arabic yeh (ي U+064A) and kaf (ك U+0643) are normalized to Persian ی / ک.
 */
export function isSyntheticAlbumTask(task: Pick<ProjectTaskItem, 'title'>): boolean {
  const title = (task.title ?? '')
    .replace(/‌/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .trim();
  return title.startsWith(SYNTHETIC_ALBUM_TITLE_PREFIX);
}
