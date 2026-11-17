import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PERSIAN_MONTH_NAMES } from '@/shared/lib/jalali';

const tasksApi = vi.hoisted(() => ({
  createTask: vi.fn().mockResolvedValue({ id: 'cal-created-1', status: 'draft' }),
  updateTask: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/features/tasks/api', () => tasksApi);

import {
  ProjectCalendarTab,
  buildCalendarDayAriaLabel,
  formatCalendarDayJalali,
} from '../components/ProjectCalendarTab';

describe('calendar day label helpers', () => {
  it('formats Jalali day in Farsi digits and month name', () => {
    expect(formatCalendarDayJalali(1405, 1, 1)).toBe(`۱ ${PERSIAN_MONTH_NAMES[0]} ۱۴۰۵`);
  });

  it('builds the Farsi aria-label for a day cell', () => {
    expect(buildCalendarDayAriaLabel(1405, 1, 1)).toBe(
      `ایجاد وظیفه برای ۱ ${PERSIAN_MONTH_NAMES[0]} ۱۴۰۵`,
    );
  });
});

function firstDayCell(): HTMLElement {
  const dayButtons = screen.getAllByRole('button', { name: /^ایجاد وظیفه برای/ });
  const first = dayButtons[0];
  if (!first) throw new Error('no day cells rendered');
  return first;
}

describe('ProjectCalendarTab day click creates task', () => {
  beforeEach(() => {
    tasksApi.createTask.mockClear();
    tasksApi.updateTask.mockClear();
  });

  it('opens create dialog from a day cell and saves ISO due_date', async () => {
    const onTasksChanged = vi.fn();
    render(
      <ProjectCalendarTab
        projectId="p-1"
        tasks={[]}
        onTasksChanged={onTasksChanged}
      />,
    );

    const dayCell = firstDayCell();
    const cellTestId = dayCell.getAttribute('data-testid') ?? '';
    const isoDate = cellTestId.replace('calendar-cell-', '');
    expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    fireEvent.click(dayCell);
    const dialog = screen.getByTestId('calendar-create-dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('calendar-create-title'), {
      target: { value: 'وظیفه تقویم' },
    });
    fireEvent.click(screen.getByTestId('calendar-create-submit'));

    await waitFor(() => expect(tasksApi.createTask).toHaveBeenCalledTimes(1));
    expect(tasksApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'p-1',
        title: 'وظیفه تقویم',
        due_date: isoDate,
      }),
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('calendar-create-dialog')).not.toBeInTheDocument();
  });

  it('keyboard Enter on a focused day cell opens the create dialog', () => {
    render(<ProjectCalendarTab projectId="p-1" tasks={[]} />);
    fireEvent.keyDown(firstDayCell(), { key: 'Enter' });
    expect(screen.getByTestId('calendar-create-dialog')).toBeInTheDocument();
  });
});
