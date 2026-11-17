import { describe, expect, it } from 'vitest';
import {
  TASK_LABEL_CHIP_CLASSES,
  TASK_LABEL_COLORS,
  clampReminderHour,
  collectProjectLabels,
  computeReminderIso,
  createTaskLabel,
  parseRemindAt,
  parseTaskLabels,
  reminderIsoFromDate,
} from '../lib/taskLabelsAndReminder';

describe('task label palette', () => {
  it('offers six soft colors and a chip class for each', () => {
    expect(TASK_LABEL_COLORS).toEqual(['green', 'blue', 'purple', 'pink', 'orange', 'grey']);
    for (const color of TASK_LABEL_COLORS) {
      expect(TASK_LABEL_CHIP_CLASSES[color]).toMatch(/bg-/);
    }
  });
});

describe('parseTaskLabels', () => {
  it('keeps valid labels, trims names, falls back to grey and drops duplicates', () => {
    const parsed = parseTaskLabels([
      { id: 'a', name: ' نقشه ', color: 'blue' },
      { name: 'حقوقی', color: 'unknown' },
      { name: 'حقوقی', color: 'pink' },
      { name: '   ' },
      'bad',
    ]);
    expect(parsed).toEqual([
      { id: 'a', name: 'نقشه', color: 'blue' },
      { id: 'حقوقی', name: 'حقوقی', color: 'grey' },
    ]);
  });

  it('returns an empty list for non-array input', () => {
    expect(parseTaskLabels(undefined)).toEqual([]);
    expect(parseTaskLabels({ name: 'x' })).toEqual([]);
  });
});

describe('createTaskLabel', () => {
  it('returns null for blank names', () => {
    expect(createTaskLabel('   ', 'green')).toBeNull();
  });

  it('builds a label with a normalized id', () => {
    expect(createTaskLabel(' Urgent ', 'orange')).toEqual({
      id: 'urgent',
      name: 'Urgent',
      color: 'orange',
    });
  });
});

describe('collectProjectLabels', () => {
  it('unions labels across tasks, keeps first color per id and sorts by name', () => {
    const labels = collectProjectLabels([
      { metadata: { labels: [{ id: 'b', name: 'ب', color: 'blue' }] } },
      { metadata: { labels: [{ id: 'a', name: 'الف', color: 'green' }, { id: 'b', name: 'ب', color: 'pink' }] } },
      { metadata: {} },
      null,
      undefined,
    ]);
    expect(labels.map((l) => l.id)).toEqual(['a', 'b']);
    expect(labels.find((l) => l.id === 'b')?.color).toBe('blue');
  });
});

describe('reminder time helpers', () => {
  it('clamps the hour into 0..23 and defaults NaN to 9', () => {
    expect(clampReminderHour(-3)).toBe(0);
    expect(clampReminderHour(40)).toBe(23);
    expect(clampReminderHour(Number.NaN)).toBe(9);
  });

  it('computes today, tomorrow and day-after-tomorrow at the chosen hour', () => {
    const now = new Date(2026, 10, 17, 14, 30, 0, 0);
    const today = new Date(computeReminderIso(0, 9, now));
    const tomorrow = new Date(computeReminderIso(1, 18, now));
    const dayAfter = new Date(computeReminderIso(2, 7, now));
    expect([today.getDate(), today.getHours(), today.getMinutes()]).toEqual([17, 9, 0]);
    expect([tomorrow.getDate(), tomorrow.getHours()]).toEqual([18, 18]);
    expect([dayAfter.getDate(), dayAfter.getHours()]).toEqual([19, 7]);
  });

  it('builds remind_at from a Gregorian YYYY-MM-DD date and rejects malformed dates', () => {
    const iso = reminderIsoFromDate('2026-11-20', 12);
    expect(iso).not.toBeNull();
    const d = new Date(iso as string);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 20, 12]);
    expect(reminderIsoFromDate('20-11-2026', 12)).toBeNull();
  });

  it('accepts only parseable remind_at strings', () => {
    expect(parseRemindAt('2026-11-20T09:00:00.000Z')).toBe('2026-11-20T09:00:00.000Z');
    expect(parseRemindAt('not a date')).toBeNull();
    expect(parseRemindAt(null)).toBeNull();
    expect(parseRemindAt('')).toBeNull();
  });
});
