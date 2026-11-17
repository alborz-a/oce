export type TaskLabelColor = 'green' | 'blue' | 'purple' | 'pink' | 'orange' | 'grey';

export interface TaskLabel {
  id: string;
  name: string;
  color: TaskLabelColor;
}

export const TASK_LABEL_COLORS: readonly TaskLabelColor[] = [
  'green',
  'blue',
  'purple',
  'pink',
  'orange',
  'grey',
];

export const TASK_LABEL_CHIP_CLASSES: Record<TaskLabelColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  grey: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const TASK_LABEL_SWATCH_CLASSES: Record<TaskLabelColor, string> = {
  green: 'bg-emerald-400',
  blue: 'bg-sky-400',
  purple: 'bg-violet-400',
  pink: 'bg-pink-400',
  orange: 'bg-orange-400',
  grey: 'bg-slate-400',
};

export const DEFAULT_REMINDER_HOUR = 9;

export function isTaskLabelColor(value: unknown): value is TaskLabelColor {
  return typeof value === 'string' && (TASK_LABEL_COLORS as readonly string[]).includes(value);
}

export function taskLabelKey(name: string): string {
  return name.trim().toLowerCase();
}

export function parseTaskLabels(raw: unknown): TaskLabel[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TaskLabel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) continue;
    const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : taskLabelKey(name);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, color: isTaskLabelColor(rec.color) ? rec.color : 'grey' });
  }
  return out;
}

export function createTaskLabel(name: string, color: TaskLabelColor): TaskLabel | null {
  const clean = name.trim();
  if (!clean) return null;
  return { id: taskLabelKey(clean), name: clean, color };
}

export function collectProjectLabels(
  sources: ReadonlyArray<{ metadata?: Record<string, unknown> | null } | null | undefined>,
): TaskLabel[] {
  const byId = new Map<string, TaskLabel>();
  for (const source of sources) {
    for (const label of parseTaskLabels(source?.metadata?.labels)) {
      if (!byId.has(label.id)) byId.set(label.id, label);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

export function clampReminderHour(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_REMINDER_HOUR;
  return Math.max(0, Math.min(23, Math.trunc(hour)));
}

export function computeReminderIso(dayOffset: number, hour: number, now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + dayOffset);
  d.setHours(clampReminderHour(hour), 0, 0, 0);
  return d.toISOString();
}

export function reminderIsoFromDate(dateYmd: string, hour: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), clampReminderHour(hour), 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseRemindAt(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}
