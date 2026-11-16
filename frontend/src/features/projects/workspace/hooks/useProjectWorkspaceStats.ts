import { useMemo } from 'react';
import type {
  BoardProgressRow,
  ProjectSummaryStats,
  ProjectTaskItem,
  StatusBreakdown,
} from '../types';

export type TaskWorkState = 'done' | 'delayed' | 'in_progress' | 'remaining';

export interface WorkspaceStatsOptions {
  /** Optional YYYY-MM-DD override for deterministic overdue comparison in tests. */
  todayIso?: string;
}

export function mapStatusToBoardLabel(status: string | null | undefined): string {
  const normalized = (status ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'draft':
    case 'open':
    case 'todo':
      return 'برای انجام';
    case 'in_progress':
      return 'در حال انجام';
    case 'review':
      return 'در حال بررسی';
    case 'done':
    case 'completed':
      return 'انجام شده';
    default:
      return normalized || 'برای انجام';
  }
}

export function isTopicConversationTask(task: Pick<ProjectTaskItem, 'task_type' | 'metadata'>): boolean {
  if ((task.task_type ?? '').trim().toLowerCase() === 'topic') return true;
  if (task.metadata?.is_project_conversation === true) return true;
  return false;
}

export function getTaskEffectiveWeight(task: Pick<ProjectTaskItem, 'weight' | 'metadata'>): number {
  const raw = task.weight ?? task.metadata?.weight ?? 1;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function getTaskEffectiveProgress(
  task: Pick<ProjectTaskItem, 'progress' | 'checklist_progress' | 'metadata'>,
): number {
  const raw = task.progress ?? task.checklist_progress ?? task.metadata?.progress ?? 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

export function classifyTaskWorkState(
  task: ProjectTaskItem,
  todayIso: string,
): TaskWorkState {
  const statusLower = (task.status ?? '').trim().toLowerCase();
  const progress = getTaskEffectiveProgress(task);

  if (
    statusLower === 'done' ||
    statusLower === 'completed' ||
    task.completed_at != null ||
    progress >= 100
  ) {
    return 'done';
  }

  const dueStr =
    typeof task.due_date === 'string' && task.due_date.trim()
      ? task.due_date.trim().slice(0, 10)
      : null;

  if (
    statusLower === 'delayed' ||
    statusLower === 'overdue' ||
    (dueStr !== null && dueStr < todayIso) ||
    (dueStr === null && task.is_overdue === true)
  ) {
    return 'delayed';
  }

  if (progress > 0 || statusLower === 'in_progress') {
    return 'in_progress';
  }

  return 'remaining';
}

function roundPercentagesSum100(weights: readonly [number, number, number, number], totalWeight: number): [number, number, number, number] {
  if (totalWeight <= 0) return [0, 0, 0, 0];

  const exact = weights.map((w) => (w / totalWeight) * 100);
  const floors = exact.map((val) => Math.floor(val));
  const remainders = exact.map((val, idx) => ({ idx, rem: val - floors[idx]! }));
  let left = 100 - floors.reduce((sum, n) => sum + n, 0);

  remainders.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remainders.length && left > 0; i += 1) {
    const entry = remainders[i]!;
    if (entry.rem > 0) {
      floors[entry.idx] = (floors[entry.idx] ?? 0) + 1;
      left -= 1;
    }
  }

  return [floors[0] ?? 0, floors[1] ?? 0, floors[2] ?? 0, floors[3] ?? 0];
}

export function computeStatusBreakdown(
  tasks: readonly ProjectTaskItem[],
  todayIso: string,
): StatusBreakdown {
  let doneWeight = 0;
  let inProgressWeight = 0;
  let delayedWeight = 0;
  let remainingWeight = 0;

  let doneCount = 0;
  let inProgressCount = 0;
  let delayedCount = 0;
  let remainingCount = 0;

  for (const task of tasks) {
    const weight = getTaskEffectiveWeight(task);
    const state = classifyTaskWorkState(task, todayIso);
    switch (state) {
      case 'done':
        doneWeight += weight;
        doneCount += 1;
        break;
      case 'in_progress':
        inProgressWeight += weight;
        inProgressCount += 1;
        break;
      case 'delayed':
        delayedWeight += weight;
        delayedCount += 1;
        break;
      case 'remaining':
        remainingWeight += weight;
        remainingCount += 1;
        break;
    }
  }

  const totalWeight = doneWeight + inProgressWeight + delayedWeight + remainingWeight;
  const [donePct, inProgressPct, delayedPct, remainingPct] = roundPercentagesSum100(
    [doneWeight, inProgressWeight, delayedWeight, remainingWeight],
    totalWeight,
  );

  return {
    donePct,
    inProgressPct,
    delayedPct,
    remainingPct,
    doneCount,
    inProgressCount,
    delayedCount,
    remainingCount,
    totalWeight,
  };
}

export function isTaskAssignedToUser(
  task: Pick<ProjectTaskItem, 'responsible_id' | 'persons_involved'>,
  currentUserId: string | null | undefined,
): boolean {
  if (!currentUserId) return false;
  if (task.responsible_id && task.responsible_id === currentUserId) return true;
  if (Array.isArray(task.persons_involved) && task.persons_involved.includes(currentUserId)) {
    return true;
  }
  return false;
}

export function computeProjectWorkspaceStats(
  tasks: readonly ProjectTaskItem[],
  currentUserId: string | null | undefined,
  options?: WorkspaceStatsOptions,
): ProjectSummaryStats {
  const todayIso = options?.todayIso ?? new Date().toISOString().slice(0, 10);
  const workTasks = tasks.filter((t) => !isTopicConversationTask(t));

  const mineTasks: ProjectTaskItem[] = [];
  const othersTasks: ProjectTaskItem[] = [];
  const boardGroups = new Map<string, ProjectTaskItem[]>();

  for (const task of workTasks) {
    if (isTaskAssignedToUser(task, currentUserId)) {
      mineTasks.push(task);
    } else {
      othersTasks.push(task);
    }

    const rawBoard =
      typeof task.metadata?.mizito_board === 'string'
        ? task.metadata.mizito_board.trim()
        : '';
    const boardKey = rawBoard || mapStatusToBoardLabel(task.status);
    const bucket = boardGroups.get(boardKey);
    if (bucket) {
      bucket.push(task);
    } else {
      boardGroups.set(boardKey, [task]);
    }
  }

  const overall = computeStatusBreakdown(workTasks, todayIso);
  const mine = computeStatusBreakdown(mineTasks, todayIso);
  const others = computeStatusBreakdown(othersTasks, todayIso);

  const boards: BoardProgressRow[] = [];
  for (const [key, groupTasks] of boardGroups.entries()) {
    const bd = computeStatusBreakdown(groupTasks, todayIso);
    boards.push({
      key,
      label: key,
      donePct: bd.donePct,
      inProgressPct: bd.inProgressPct,
      delayedPct: bd.delayedPct,
      remainingPct: bd.remainingPct,
      totalCount: groupTasks.length,
      doneCount: bd.doneCount,
    });
  }

  // Remaining incomplete tasks count across the project (controls the all-done check view).
  const incompleteCount = overall.inProgressCount + overall.delayedCount + overall.remainingCount;

  return {
    totalWeight: overall.totalWeight,
    remainingCount: incompleteCount,
    overall,
    mine,
    others,
    boards,
  };
}

export function useProjectWorkspaceStats(
  tasks: readonly ProjectTaskItem[],
  currentUserId: string | null | undefined,
  options?: WorkspaceStatsOptions,
): ProjectSummaryStats {
  const todayIso = options?.todayIso;
  return useMemo(
    () => computeProjectWorkspaceStats(tasks, currentUserId, { todayIso }),
    [tasks, currentUserId, todayIso],
  );
}
