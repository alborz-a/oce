import { toLatinDigits } from '@/shared/lib/jalali';
import type { ProjectTaskChecklistItem, ProjectTaskItem } from '../types';

/** Lowercase, trim, and map Persian/Arabic digits to Latin so "۱۲" matches "12". */
export function normalizeSearchText(input: string): string {
  return toLatinDigits(input).toLowerCase().trim();
}

/** True when the normalized query is empty or found in title or description. */
export function matchesTaskSearch(
  task: Pick<ProjectTaskItem, 'title' | 'description'>,
  query: string,
): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const title = normalizeSearchText(task.title ?? '');
  const description = normalizeSearchText(task.description ?? '');
  return title.includes(q) || description.includes(q);
}

export interface ChecklistCounts {
  done: number;
  total: number;
}

export function getChecklistCounts(
  checklist?: ProjectTaskChecklistItem[] | null,
): ChecklistCounts {
  if (!Array.isArray(checklist)) return { done: 0, total: 0 };
  let done = 0;
  for (const item of checklist) {
    if (item && (item.done === true || item.completed === true)) done += 1;
  }
  return { done, total: checklist.length };
}

/** Attachments = linked documents already present on the loaded task (document_ids). */
export function getAttachmentCount(task: Pick<ProjectTaskItem, 'document_ids'>): number {
  return Array.isArray(task.document_ids) ? task.document_ids.length : 0;
}

/** Progress percent 0-100, or null when the task carries no progress value at all. */
export function getTaskProgressPercent(
  task: Pick<ProjectTaskItem, 'progress' | 'checklist_progress' | 'metadata'>,
): number | null {
  const raw = task.progress ?? task.checklist_progress ?? task.metadata?.progress;
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(Math.max(0, Math.min(100, parsed)));
}

export interface TaskDueFilters {
  hasDueOnly: boolean;
  overdueOnly: boolean;
}

/** Due-date filters. `isOverdue` is the caller's already-classified delayed state. */
export function matchesTaskDueFilters(
  task: Pick<ProjectTaskItem, 'due_date'>,
  filters: TaskDueFilters,
  isOverdue: boolean,
): boolean {
  if (filters.hasDueOnly && !task.due_date) return false;
  if (filters.overdueOnly && !isOverdue) return false;
  return true;
}
