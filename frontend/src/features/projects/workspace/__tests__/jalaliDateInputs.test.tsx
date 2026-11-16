import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_STREAM_FILTERS } from '../types';
import { ProjectStreamFilterBar } from '../components/ProjectStreamFilterBar';
import { formatJalali } from '@/shared/lib/jalali';

vi.mock('@/shared/lib/api', () => ({
  downloadWithAuth: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('ProjectStreamFilterBar Jalali date pickers', () => {
  it('renders no native date inputs and shows the Jalali display for a set date', () => {
    const { container } = render(
      <ProjectStreamFilterBar
        filter={{ ...DEFAULT_STREAM_FILTERS, dateFrom: '2026-11-16' }}
        onChange={vi.fn()}
        members={[]}
      />,
    );
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0);
    // Jalali picker trigger shows the Persian-formatted date for the ISO value.
    const expected = formatJalali('2026-11-16');
    expect(expected).toMatch(/[۰-۹]/);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it('emits an ISO yyyy-mm-dd value to onChange when a date is picked', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ProjectStreamFilterBar
        filter={DEFAULT_STREAM_FILTERS}
        onChange={onChange}
        members={[]}
      />,
    );
    const trigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'),
    ).find((b) => b.textContent?.includes('----/--/--'))!;
    fireEvent.click(trigger);
    const todayBtn = screen
      .getAllByText('امروز', { selector: 'button' })
      .find((b) => b.closest('[role="dialog"]'))!;
    fireEvent.click(todayBtn);
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_STREAM_FILTERS,
      dateFrom: toIsoDate(new Date()),
    });
  });
});
