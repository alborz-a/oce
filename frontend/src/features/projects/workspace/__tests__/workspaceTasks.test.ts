import '@testing-library/jest-dom/vitest';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as tasksApi from '@/features/tasks/api';
import * as sharedApi from '@/shared/lib/api';
import { ProjectTasksTab } from '../components/ProjectTasksTab';
import { TaskQuickDetailDialog } from '../components/TaskQuickDetailDialog';
import type { ProjectTaskItem } from '../types';

vi.mock('@/features/tasks/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/api')>();
  return {
    ...actual,
    createTask: vi.fn().mockResolvedValue({ id: 'new-task-1', status: 'draft' }),
    updateTask: vi.fn().mockResolvedValue({ id: 'updated-1' }),
    completeTask: vi.fn().mockResolvedValue({ id: 'completed-1' }),
  };
});

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn().mockResolvedValue([]),
    apiPost: vi.fn().mockResolvedValue({
      id: 'comment-new',
      author_name: 'کاربر تست',
      text: 'گزارش پیشرفت ثبت شد',
      created_at: '2026-11-16T10:00:00Z',
    }),
  };
});

function makeTask(overrides: Partial<ProjectTaskItem> = {}): ProjectTaskItem {
  return {
    id: overrides.id ?? 't-1',
    project_id: overrides.project_id ?? 'proj-1',
    title: overrides.title ?? 'بررسی سند زمین بسیج',
    task_type: overrides.task_type ?? 'task',
    status: overrides.status ?? 'open',
    created_at: overrides.created_at ?? '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

describe('ProjectTasksTab & TaskQuickDetailDialog (Tab 2 وظایف پروژه)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom lacks native HTMLDialogElement.showModal/close implementations
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    });
  });

  it('excludes topic tasks, filters views/search, shows +N more labels, creates task in <dialog>, and toggles files', async () => {
    const onTasksChanged = vi.fn();
    const onSelectTask = vi.fn();

    const tasks: ProjectTaskItem[] = [
      makeTask({ id: 'topic-1', title: 'گفتگوی پروژه', task_type: 'topic' }),
      makeTask({
        id: 't-undated',
        title: 'کار بدون تاریخ',
        status: 'open',
        due_date: null,
        metadata: { mizito_labels: ['نقشه', 'دفتر فنی', 'حقوقی'] },
      }),
      makeTask({
        id: 't-delayed',
        title: 'کار تاخیردار',
        status: 'open',
        due_date: '2025-01-01',
      }),
      makeTask({
        id: 't-done',
        title: 'کار تکمیل شده',
        status: 'completed',
      }),
    ];

    render(
      React.createElement(ProjectTasksTab, {
        projectId: 'proj-1',
        tasks,
        onTasksChanged,
        onSelectTask,
      }),
    );

    // Topic excluded & completed hidden in default 'incomplete' view
    expect(screen.queryByText('گفتگوی پروژه')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tasks-row-t-done')).not.toBeInTheDocument();
    expect(screen.getByTestId('tasks-row-t-undated')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-row-t-delayed')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-row-more-labels-t-undated')).toHaveTextContent('۱ تا بیشتر...');

    // Switch view filter to 'all' reveals completed task
    fireEvent.change(screen.getByTestId('tasks-view-select'), { target: { value: 'all' } });
    expect(screen.getByTestId('tasks-row-t-done')).toBeInTheDocument();

    // Switch to 'delayed' shows only delayed
    fireEvent.change(screen.getByTestId('tasks-view-select'), { target: { value: 'delayed' } });
    expect(screen.getByTestId('tasks-row-t-delayed')).toBeInTheDocument();
    expect(screen.queryByTestId('tasks-row-t-undated')).not.toBeInTheDocument();

    // Click task row triggers onSelectTask
    fireEvent.click(screen.getByTestId('tasks-row-title-t-delayed'));
    expect(onSelectTask).toHaveBeenCalledWith(expect.objectContaining({ id: 't-delayed' }));

    // Toggle completion calls completeTask
    fireEvent.click(screen.getByTestId('tasks-row-check-t-delayed'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('t-delayed'));

    // Open native <dialog> via + ایجاد وظیفه and verify no forbidden ARIA attributes
    fireEvent.click(screen.getByTestId('tasks-create-button'));
    const createDialog = screen.getByTestId('tasks-create-dialog');
    expect(createDialog).not.toHaveAttribute('role');
    expect(createDialog).not.toHaveAttribute('aria-modal');
    expect(createDialog).not.toHaveAttribute('popover');

    fireEvent.change(screen.getByTestId('tasks-create-title-input'), {
      target: { value: 'وظیفه جدید تست' },
    });
    fireEvent.click(screen.getByTestId('tasks-create-submit'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-1',
          title: 'وظیفه جدید تست',
          task_type: 'task',
        }),
      ),
    );

    // Click مشاهده فایل‌ها toggles drawer
    fireEvent.click(screen.getByTestId('tasks-files-button'));
    expect(screen.getByTestId('tasks-files-drawer')).toBeInTheDocument();
  });

  it('TaskQuickDetailDialog uses native <dialog>, edits task fields, and posts گزارش جدید comment', async () => {
    const onClose = vi.fn();
    const onUpdated = vi.fn();
    const task = makeTask({
      id: 'detail-1',
      title: 'بتن‌ریزی سقف دوم',
      status: 'in_progress',
      progress: 40,
      weight: 3,
    });

    render(
      React.createElement(TaskQuickDetailDialog, {
        projectId: 'proj-1',
        task,
        open: true,
        onClose,
        onUpdated,
      }),
    );

    const dialog = screen.getByTestId('task-quick-detail-dialog');
    expect(dialog).not.toHaveAttribute('role');
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(dialog).not.toHaveAttribute('popover');
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();

    // Update title & weight and save
    fireEvent.change(screen.getByTestId('task-detail-title-input'), {
      target: { value: 'بتن‌ریزی سقف دوم (تایید شده)' },
    });
    fireEvent.change(screen.getByTestId('task-detail-weight-input'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByTestId('task-detail-save-button'));

    await waitFor(() =>
      expect(tasksApi.updateTask).toHaveBeenCalledWith(
        'detail-1',
        expect.objectContaining({
          title: 'بتن‌ریزی سقف دوم (تایید شده)',
          metadata: expect.objectContaining({ weight: 5 }),
        }),
      ),
    );
    expect(onUpdated).toHaveBeenCalled();

    // Post گزارش جدید comment
    fireEvent.change(screen.getByTestId('task-detail-report-input'), {
      target: { value: 'گزارش پیشرفت ثبت شد' },
    });
    fireEvent.click(screen.getByTestId('task-detail-report-submit'));

    await waitFor(() =>
      expect(sharedApi.apiPost).toHaveBeenCalledWith(
        '/v1/collaboration/comments/',
        expect.objectContaining({
          entity_type: 'task',
          entity_id: 'detail-1',
          text: 'گزارش پیشرفت ثبت شد',
          comment_type: 'comment',
        }),
      ),
    );
    expect(screen.getByText('گزارش پیشرفت ثبت شد')).toBeInTheDocument();
  });
});
