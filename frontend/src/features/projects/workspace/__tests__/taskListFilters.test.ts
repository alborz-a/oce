import { describe, expect, it } from 'vitest';
import {
  getAttachmentCount,
  getChecklistCounts,
  getTaskProgressPercent,
  matchesTaskDueFilters,
  matchesTaskSearch,
  normalizeSearchText,
} from '../lib/taskListFilters';

describe('task list search', () => {
  it('matches Persian and Arabic digits against Latin digits', () => {
    expect(normalizeSearchText('۱۲ و ٣')).toBe('12 و 3');
    expect(matchesTaskSearch({ title: 'فاز 12', description: null }, '۱۲')).toBe(true);
    expect(matchesTaskSearch({ title: 'بازدید ٣', description: null }, '3')).toBe(true);
  });

  it('matches title or description case-insensitively and ignores empty query', () => {
    const task = { title: 'Site Visit', description: 'نقشه طبقه دوم' };
    expect(matchesTaskSearch(task, 'site')).toBe(true);
    expect(matchesTaskSearch(task, '  نقشه ')).toBe(true);
    expect(matchesTaskSearch(task, 'missing')).toBe(false);
    expect(matchesTaskSearch(task, '   ')).toBe(true);
  });

  it('handles null title and description without throwing', () => {
    expect(matchesTaskSearch({ title: '', description: null }, 'x')).toBe(false);
  });
});

describe('task row counters', () => {
  it('counts checklist done and total', () => {
    expect(
      getChecklistCounts([{ done: true }, { completed: true }, { done: false }]),
    ).toEqual({ done: 2, total: 3 });
    expect(getChecklistCounts(undefined)).toEqual({ done: 0, total: 0 });
    expect(getChecklistCounts(null)).toEqual({ done: 0, total: 0 });
  });

  it('counts attachments from document_ids', () => {
    expect(getAttachmentCount({ document_ids: ['a', 'b'] })).toBe(2);
    expect(getAttachmentCount({ document_ids: undefined })).toBe(0);
  });

  it('returns null progress when no value exists and clamps otherwise', () => {
    expect(getTaskProgressPercent({ metadata: {} })).toBeNull();
    expect(getTaskProgressPercent({ progress: 42.4 })).toBe(42);
    expect(getTaskProgressPercent({ checklist_progress: 150 })).toBe(100);
    expect(getTaskProgressPercent({ metadata: { progress: 'abc' } })).toBeNull();
  });
});

describe('task due filters', () => {
  it('applies has-due-date and overdue filters', () => {
    const dated = { due_date: '2026-11-01' };
    const undated = { due_date: null };
    expect(matchesTaskDueFilters(undated, { hasDueOnly: true, overdueOnly: false }, false)).toBe(false);
    expect(matchesTaskDueFilters(dated, { hasDueOnly: true, overdueOnly: false }, false)).toBe(true);
    expect(matchesTaskDueFilters(dated, { hasDueOnly: false, overdueOnly: true }, false)).toBe(false);
    expect(matchesTaskDueFilters(dated, { hasDueOnly: false, overdueOnly: true }, true)).toBe(true);
    expect(matchesTaskDueFilters(undated, { hasDueOnly: false, overdueOnly: false }, false)).toBe(true);
  });
});
