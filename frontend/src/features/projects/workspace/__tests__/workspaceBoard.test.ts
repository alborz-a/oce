import '@testing-library/jest-dom/vitest';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as tasksApi from '@/features/tasks/api';
import {
  ProjectBoardTab,
  extractMizitoLabels,
  mapBoardLabelToTaskStatus,
  resolveTaskBoardColumn,
} from '../components/ProjectBoardTab';
import type { ProjectTaskItem } from '../types';

vi.mock('@/features/tasks/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/api')>();
  return {
    ...actual,
    createTask: vi.fn().mockResolvedValue({ id: 'created-1' }),
    updateTask: vi.fn().mockResolvedValue({ id: 'updated-1' }),
    completeTask: vi.fn().mockResolvedValue({ id: 'completed-1' }),
  };
});

function makeTask(overrides: Partial<ProjectTaskItem> = {}): ProjectTaskItem {
  return {
    id: overrides.id ?? 't-1',
    project_id: overrides.project_id ?? 'proj-1',
    title: overrides.title ?? 'تهیه نقشه اجرایی',
    task_type: overrides.task_type ?? 'task',
    status: overrides.status ?? 'open',
    created_at: overrides.created_at ?? '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

describe('ProjectBoardTab (Tab 3 بورد پروژه)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('resolves board columns, statuses, and Mizito labels cleanly', () => {
    expect(resolveTaskBoardColumn(makeTask({ status: 'open' }))).toBe('برای انجام');
    expect(
      resolveTaskBoardColumn(makeTask({ metadata: { mizito_board: 'سرداران 2' } })),
    ).toBe('سرداران 2');
    expect(mapBoardLabelToTaskStatus('انجام شده')).toBe('completed');
    expect(mapBoardLabelToTaskStatus('در حال انجام')).toBe('in_progress');
    expect(extractMizitoLabels({ mizito_labels: ['نقشه', { name: 'فوری', color: '#d9534f' }] })).toHaveLength(2);
  });

  it('excludes topic tasks, renders columns/cards/checklists/labels, and handles create/complete/checklist/move', async () => {
    const onTasksChanged = vi.fn();
    const onSelectTask = vi.fn();

    const tasks: ProjectTaskItem[] = [
      makeTask({ id: 'topic-1', title: 'گفتگوی پروژه', task_type: 'topic' }),
      makeTask({
        id: 't-done',
        title: 'برنامه زمان‌بندی بسیج ۱۸',
        status: 'completed',
        metadata: { mizito_board: 'برای انجام', mizito_labels: ['دفتر فنی'] },
      }),
      makeTask({
        id: 't-delay',
        title: 'بررسی سند زمین بسیج',
        status: 'open',
        due_date: '2025-01-10',
        checklist: [{ id: 'c1', text: 'استعلام ثبت', completed: false }],
        metadata: {
          mizito_board: 'برای انجام',
          mizito_labels: [{ name: 'حقوقی', color: '#ba68c8' }],
        },
      }),
      makeTask({
        id: 't-other',
        title: 'آرماتور فونداسیون',
        status: 'in_progress',
        metadata: { mizito_board: 'سرداران 2' },
      }),
    ];

    render(
      React.createElement(ProjectBoardTab, {
        projectId: 'proj-1',
        tasks,
        focusedBoardKey: 'سرداران 2',
        onTasksChanged,
        onSelectTask,
      }),
    );

    // Topic excluded
    expect(screen.queryByText('گفتگوی پروژه')).not.toBeInTheDocument();

    // Both columns rendered + focusedBoardKey scrolled
    expect(screen.getByTestId('board-column-برای انجام')).toBeInTheDocument();
    expect(screen.getByTestId('board-column-سرداران 2')).toBeInTheDocument();
    expect(screen.getByTestId('board-column-سرداران 2').className).toContain('ring-[#3078ab]/30');

    // Card details: labels, delayed due badge, checklist item
    expect(screen.getByText('دفتر فنی')).toBeInTheDocument();
    expect(screen.getByText('حقوقی')).toBeInTheDocument();
    expect(screen.getByTestId('board-card-due-t-delay').className).toContain('border-[#d9534f]');
    expect(screen.getByText('استعلام ثبت')).toBeInTheDocument();

    // Click card title invokes onSelectTask
    fireEvent.click(screen.getByTestId('board-card-title-t-delay'));
    expect(onSelectTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't-delay' }));

    // Complete task calls completeTask
    fireEvent.click(screen.getByTestId('board-card-complete-t-delay'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('t-delay'));

    // Toggle checklist item calls updateTask
    fireEvent.click(screen.getByTestId('board-card-checkitem-t-delay-0'));
    await waitFor(() =>
      expect(tasksApi.updateTask).toHaveBeenCalledWith('t-delay', {
        checklist: [{ id: 'c1', text: 'استعلام ثبت', completed: true }],
      }),
    );

    // Move task via accessible select calls updateTask with target mizito_board
    fireEvent.change(screen.getByTestId('board-card-move-t-delay'), {
      target: { value: 'سرداران 2' },
    });
    await waitFor(() =>
      expect(tasksApi.updateTask).toHaveBeenCalledWith(
        't-delay',
        expect.objectContaining({
          metadata: expect.objectContaining({ mizito_board: 'سرداران 2' }),
        }),
      ),
    );

    // Inline quick add calls createTask with mizito_board
    fireEvent.click(screen.getByTestId('board-add-task-سرداران 2'));
    fireEvent.change(screen.getByTestId('board-quick-add-input-سرداران 2'), {
      target: { value: 'بتن مگر پی' },
    });
    fireEvent.click(screen.getByTestId('board-quick-add-submit-سرداران 2'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-1',
          title: 'بتن مگر پی',
          metadata: { mizito_board: 'سرداران 2' },
        }),
      ),
    );

    // Add new list column persists
    fireEvent.click(screen.getByTestId('board-add-list-button'));
    fireEvent.change(screen.getByTestId('board-new-list-input'), {
      target: { value: 'بازبینی نهایی' },
    });
    fireEvent.click(screen.getByTestId('board-new-list-submit'));
    expect(screen.getByTestId('board-column-بازبینی نهایی')).toBeInTheDocument();
  });
});
