import { describe, expect, it } from 'vitest';
import type { Task } from '@/features/tasks/api';
import {
  classifyTaskWorkState,
  computeProjectWorkspaceStats,
  getTaskEffectiveWeight,
  isTopicConversationTask,
} from '../hooks/useProjectWorkspaceStats';
import type { ProjectTaskItem } from '../types';

function makeTask(overrides: Partial<ProjectTaskItem> = {}): ProjectTaskItem {
  return {
    id: overrides.id ?? 'task-1',
    project_id: overrides.project_id ?? 'proj-1',
    title: overrides.title ?? 'Sample Task',
    task_type: overrides.task_type ?? 'task',
    status: overrides.status ?? 'open',
    created_at: overrides.created_at ?? '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

describe('useProjectWorkspaceStats / computeProjectWorkspaceStats', () => {
  const TODAY = '2026-11-16';

  it('excludes topic conversation tasks from stats, remainingCount, and boards', () => {
    const tasks: ProjectTaskItem[] = [
      makeTask({ id: 't-topic-1', task_type: 'topic', status: 'open', weight: 100 }),
      makeTask({
        id: 't-topic-2',
        task_type: 'task',
        status: 'open',
        weight: 50,
        metadata: { is_project_conversation: true },
      }),
      makeTask({ id: 't-work-1', status: 'completed', weight: 2, completed_at: '2026-11-15T00:00:00Z' }),
    ];

    const stats = computeProjectWorkspaceStats(tasks, 'u-1', { todayIso: TODAY });
    expect(stats.totalWeight).toBe(2);
    expect(stats.remainingCount).toBe(0);
    expect(stats.overall.doneCount).toBe(1);
    expect(stats.overall.donePct).toBe(100);
    expect(stats.boards).toHaveLength(1);
    expect(stats.boards[0]?.totalCount).toBe(1);
  });

  it('computes weighted 4-state breakdown using task.weight, metadata.weight, and fallback 1', () => {
    const tasks: ProjectTaskItem[] = [
      // done (weight 5)
      makeTask({ id: 'd1', status: 'done', weight: 5, due_date: '2026-01-01' }),
      // in_progress (metadata.weight 2, progress 40)
      makeTask({
        id: 'p1',
        status: 'open',
        progress: 40,
        due_date: '2026-11-25',
        metadata: { weight: 2 },
      }),
      // delayed (weight 2, due_date < today)
      makeTask({
        id: 'l1',
        status: 'in_progress',
        progress: 60,
        weight: 2,
        due_date: '2026-11-10',
      }),
      // remaining (invalid/zero weight falls back to 1)
      makeTask({
        id: 'r1',
        status: 'open',
        progress: 0,
        weight: 0,
        due_date: '2026-11-16', // due today is not overdue
      }),
    ];

    const stats = computeProjectWorkspaceStats(tasks, 'u-1', { todayIso: TODAY });
    expect(stats.totalWeight).toBe(10);
    expect(stats.remainingCount).toBe(3);
    expect(stats.overall).toEqual({
      donePct: 50,
      inProgressPct: 20,
      delayedPct: 20,
      remainingPct: 10,
      doneCount: 1,
      inProgressCount: 1,
      delayedCount: 1,
      remainingCount: 1,
      totalWeight: 10,
    });
  });

  it('sets remainingCount === 0 only when all non-topic tasks are done', () => {
    const allDone: ProjectTaskItem[] = [
      makeTask({ id: '1', status: 'completed' }),
      makeTask({ id: '2', status: 'open', completed_at: '2026-11-12T08:00:00Z' }),
      makeTask({ id: '3', status: 'open', progress: 100 }),
      makeTask({ id: '4', status: 'open', checklist_progress: 100 }),
      makeTask({ id: 'topic', task_type: 'topic', status: 'open' }),
    ];

    const doneStats = computeProjectWorkspaceStats(allDone, 'u-1', { todayIso: TODAY });
    expect(doneStats.remainingCount).toBe(0);
    expect(doneStats.overall.donePct).toBe(100);

    const hasDelayed = [
      ...allDone,
      makeTask({ id: '5', status: 'open', due_date: '2026-11-01' }),
    ];
    const delayedStats = computeProjectWorkspaceStats(hasDelayed, 'u-1', { todayIso: TODAY });
    expect(delayedStats.remainingCount).toBe(1);
    expect(delayedStats.overall.delayedCount).toBe(1);
  });

  it('splits mine vs others using responsible_id and persons_involved', () => {
    const tasks: ProjectTaskItem[] = [
      makeTask({ id: 'm1', responsible_id: 'u-me', status: 'completed', weight: 3 }),
      makeTask({
        id: 'm2',
        responsible_id: 'u-other',
        persons_involved: ['u-extra', 'u-me'],
        status: 'open',
        due_date: '2026-11-01',
        weight: 1,
      }),
      makeTask({ id: 'o1', responsible_id: 'u-other', status: 'open', progress: 50, weight: 2 }),
      makeTask({ id: 'o2', responsible_id: null, status: 'open', weight: 2 }),
    ];

    const stats = computeProjectWorkspaceStats(tasks, 'u-me', { todayIso: TODAY });

    expect(stats.mine.totalWeight).toBe(4);
    expect(stats.mine.doneCount).toBe(1);
    expect(stats.mine.delayedCount).toBe(1);
    expect(stats.mine.donePct).toBe(75);
    expect(stats.mine.delayedPct).toBe(25);

    expect(stats.others.totalWeight).toBe(4);
    expect(stats.others.inProgressCount).toBe(1);
    expect(stats.others.remainingCount).toBe(1);
    expect(stats.others.inProgressPct).toBe(50);
    expect(stats.others.remainingPct).toBe(50);
  });

  it('groups boards by metadata.mizito_board or mapped status while preserving column order', () => {
    const tasks: ProjectTaskItem[] = [
      makeTask({
        id: 'b1',
        status: 'completed',
        metadata: { mizito_board: 'سرداران 2' },
      }),
      makeTask({
        id: 'b2',
        status: 'open',
        metadata: { mizito_board: 'برای انجام' },
      }),
      makeTask({
        id: 'b3',
        status: 'open',
        metadata: { mizito_board: 'سرداران 2' },
      }),
      makeTask({
        id: 'b4',
        status: 'in_progress',
      }),
    ];

    const stats = computeProjectWorkspaceStats(tasks, 'u-1', { todayIso: TODAY });
    expect(stats.boards.map((b) => b.key)).toEqual(['سرداران 2', 'برای انجام', 'در حال انجام']);
    expect(stats.boards[0]).toEqual({
      key: 'سرداران 2',
      label: 'سرداران 2',
      donePct: 50,
      inProgressPct: 0,
      delayedPct: 0,
      remainingPct: 50,
      totalCount: 2,
      doneCount: 1,
    });
  });

  it('accepts backend Task shape directly without mapping and handles helper edge cases', () => {
    const backendTask: Task = {
      id: 'bk-1',
      project_id: 'proj-1',
      title: 'Backend shape',
      description: null,
      task_type: 'task',
      status: 'open',
      priority: 'normal',
      responsible_id: 'u-1',
      assigned_to: 'u-1',
      assigned_to_name: 'کاربر',
      due_date: null,
      checklist: [{ id: 'c1', text: 'Item 1', completed: false }],
      checklist_progress: 25,
      created_by: 'u-1',
      meeting_id: null,
      metadata: { weight: '3' },
      created_at: '2026-11-10T00:00:00Z',
      updated_at: '2026-11-10T00:00:00Z',
      completed_at: null,
      is_overdue: false,
    };

    const compatible: ProjectTaskItem = backendTask;
    expect(isTopicConversationTask(compatible)).toBe(false);
    expect(getTaskEffectiveWeight(compatible)).toBe(3);
    expect(classifyTaskWorkState(compatible, TODAY)).toBe('in_progress');
  });
});
