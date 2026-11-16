import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { dateToJalali, PERSIAN_MONTH_NAMES } from '@/shared/lib/jalali';
import {
  ProjectCalendarTab,
  buildJalaliMonthGrid,
  getJalaliMonthLength,
  jalaliToIsoDate,
} from '../components/ProjectCalendarTab';
import {
  ProjectGanttTab,
  buildGanttTreeAndActivities,
  resolveTaskGanttDates,
} from '../components/ProjectGanttTab';
import type { ProjectTaskItem } from '../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? _key,
    i18n: { language: 'fa' },
  }),
}));

function makeTask(overrides: Partial<ProjectTaskItem> = {}): ProjectTaskItem {
  return {
    id: overrides.id ?? 't-1',
    project_id: overrides.project_id ?? 'proj-1',
    title: overrides.title ?? 'وظیفه نمونه',
    task_type: overrides.task_type ?? 'task',
    status: overrides.status ?? 'open',
    created_at: overrides.created_at ?? '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

describe('ProjectCalendarTab (Tab 4 تقویم پروژه)', () => {
  it('computes accurate Jalali month lengths including Esfand leap years and 7-day grids', () => {
    expect(getJalaliMonthLength(1405, 1)).toBe(31);
    expect(getJalaliMonthLength(1405, 8)).toBe(30);
    // 1403 is a Jalali leap year (30 days in Esfand), 1404/1405 are common (29 days)
    expect(getJalaliMonthLength(1403, 12)).toBe(30);
    expect(getJalaliMonthLength(1404, 12)).toBe(29);
    expect(getJalaliMonthLength(1405, 12)).toBe(29);

    const grid = buildJalaliMonthGrid(1405, 8, '2026-11-16');
    expect(grid.length % 7).toBe(0);
    expect(grid.filter((c) => c.isCurrentMonth)).toHaveLength(30);
    expect(grid.some((c) => c.isToday && c.isoDate === '2026-11-16')).toBe(true);
  });

  it('renders 7-day RTL grid, filters topic tasks, toggles unscheduled panel, and navigates months', () => {
    const nowJalali = dateToJalali(new Date());
    const day10Iso = jalaliToIsoDate(nowJalali.jy, nowJalali.jm, 10);
    const onSelectTask = vi.fn();

    const tasks: ProjectTaskItem[] = [
      makeTask({ id: 'topic-1', title: 'گفتگوی پروژه', task_type: 'topic', due_date: day10Iso }),
      makeTask({
        id: 'topic-2',
        title: 'موضوع پنهان',
        metadata: { is_project_conversation: true },
        due_date: day10Iso,
      }),
      makeTask({ id: 'due-1', title: 'بتن‌ریزی فونداسیون', due_date: day10Iso, status: 'in_progress' }),
      makeTask({ id: 'undated-1', title: 'بررسی نقشه بدون سررسید', due_date: null, start_date: null }),
    ];

    render(
      React.createElement(ProjectCalendarTab, {
        projectId: 'proj-1',
        tasks,
        onSelectTask,
      }),
    );

    // Weekday headers present
    expect(screen.getByText('شنبه')).toBeInTheDocument();
    expect(screen.getByText('جمعه')).toBeInTheDocument();

    // Topic tasks excluded, scheduled task rendered on day cell
    expect(screen.queryByText('گفتگوی پروژه')).not.toBeInTheDocument();
    expect(screen.queryByText('موضوع پنهان')).not.toBeInTheDocument();
    expect(screen.getByTestId('calendar-task-due-1')).toBeInTheDocument();

    // Undated task hidden until switch toggled
    expect(screen.queryByTestId('calendar-unscheduled-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('calendar-toggle-unscheduled'));
    const unscheduled = screen.getByTestId('calendar-unscheduled-panel');
    expect(unscheduled).toHaveTextContent('بررسی نقشه بدون سررسید');

    // Selecting a task invokes onSelectTask
    fireEvent.click(screen.getByTestId('calendar-task-due-1'));
    expect(onSelectTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'due-1' }));

    // Month navigation changes current month header and Today resets it
    const expectedCurrent = PERSIAN_MONTH_NAMES[nowJalali.jm - 1] ?? '';
    expect(screen.getByTestId('calendar-month-title')).toHaveTextContent(expectedCurrent);
    fireEvent.click(screen.getByTestId('calendar-next-month'));
    const nextMonthIdx = nowJalali.jm === 12 ? 0 : nowJalali.jm;
    expect(screen.getByTestId('calendar-month-title')).toHaveTextContent(
      PERSIAN_MONTH_NAMES[nextMonthIdx] ?? '',
    );
    fireEvent.click(screen.getByTestId('calendar-today-button'));
    expect(screen.getByTestId('calendar-month-title')).toHaveTextContent(expectedCurrent);
  });
});

describe('ProjectGanttTab (Tab 5 گانت پروژه)', () => {
  it('builds board-grouped tree rows and SVGGanttChart activities with date normalization', () => {
    const tasks: ProjectTaskItem[] = [
      makeTask({
        id: 'g1',
        title: 'آرماتوربندی سقف',
        status: 'in_progress',
        start_date: '2026-11-10',
        due_date: '2026-11-20',
        progress: 60,
        metadata: { mizito_board: 'سرداران 2' },
      }),
      makeTask({
        id: 'g2',
        title: 'تست تاریخ معکوس',
        status: 'open',
        start_date: '2026-11-18',
        due_date: '2026-11-12',
        metadata: { mizito_board: 'سرداران 2' },
      }),
    ];

    const dates = resolveTaskGanttDates(tasks[1]!, '2026-11-16');
    expect(dates.start <= dates.end).toBe(true);

    const openTree = buildGanttTreeAndActivities(tasks, new Set(), '2026-11-16');
    expect(openTree.rows.map((r) => r.kind)).toEqual(['group', 'task', 'task']);
    expect(openTree.activities).toHaveLength(3);
    expect(openTree.activities[0]?.isGroup).toBe(true);

    const collapsedTree = buildGanttTreeAndActivities(
      tasks,
      new Set(['سرداران 2']),
      '2026-11-16',
    );
    expect(collapsedTree.rows).toHaveLength(1);
    expect(collapsedTree.activities).toHaveLength(1);
  });

  it('renders RTL split tree + SVGGanttChart, excludes topic tasks, collapses boards, and switches zoom', () => {
    const onSelectTask = vi.fn();
    const tasks: ProjectTaskItem[] = [
      makeTask({ id: 'topic-g', title: 'گفتگوی مخفی', task_type: 'topic' }),
      makeTask({
        id: 'task-a',
        title: 'اجرای اسکلت فلزی',
        status: 'completed',
        start_date: '2026-11-05',
        due_date: '2026-11-15',
        progress: 100,
        metadata: { mizito_board: 'برای انجام' },
      }),
      makeTask({
        id: 'task-b',
        title: 'نقشه‌برداری محوطه',
        status: 'open',
        start_date: '2026-11-12',
        due_date: '2026-11-22',
        metadata: { mizito_board: 'دفتر فنی' },
      }),
    ];

    render(
      React.createElement(ProjectGanttTab, {
        projectId: 'proj-1',
        projectName: 'بسیج 18',
        tasks,
        onSelectTask,
      }),
    );

    expect(screen.queryByText('گفتگوی مخفی')).not.toBeInTheDocument();
    expect(screen.getByTestId('gantt-task-tree')).toHaveTextContent('اجرای اسکلت فلزی');
    expect(screen.getByTestId('gantt-timeline-pane').querySelector('svg')).toBeInTheDocument();

    // Zoom buttons toggle aria-pressed
    const weekBtn = screen.getByTestId('gantt-zoom-week');
    fireEvent.click(weekBtn);
    expect(weekBtn).toHaveAttribute('aria-pressed', 'true');

    // Collapse board hides its child row
    fireEvent.click(screen.getByTestId('gantt-group-toggle-برای انجام'));
    expect(screen.queryByTestId('gantt-tree-task-task-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('gantt-tree-task-task-b')).toBeInTheDocument();

    // Clicking task row invokes onSelectTask
    fireEvent.click(screen.getByTestId('gantt-tree-task-task-b'));
    expect(onSelectTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-b' }));
  });
});
