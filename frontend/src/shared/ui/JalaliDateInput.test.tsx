import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JalaliDateInput } from './JalaliDateInput';
import { isoToJalali } from '@/shared/lib/jalali';

describe('JalaliDateInput', () => {
  it('shows Jalali text with Persian digits', () => {
    render(<JalaliDateInput value="2026-10-13" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /۱۴۰۵\/۰۷\/۲۱/ })).toBeTruthy();
  });

  it('emits ISO on day select and round-trips', () => {
    const onChange = vi.fn();
    render(<JalaliDateInput value="2026-10-13" onChange={onChange} name="d" />);
    fireEvent.click(screen.getByRole('button', { name: /۱۴۰۵\/۰۷\/۲۱/ }));
    expect(screen.getByText(/مهر ۱۴۰۵/)).toBeTruthy();
    fireEvent.click(screen.getByText('۱', { selector: 'button' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const iso = onChange.mock.calls[0]![0].target.value as string;
    expect(iso).toBe('2026-09-23');
    expect(isoToJalali(iso)).toMatch(/۱۴۰۵\/۰۷\/۰۱|1405[/-]07[/-]01/);
  });

  it('clears with پاک کردن', () => {
    const onChange = vi.fn();
    render(<JalaliDateInput value="2026-10-13" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /۱۴۰۵/ }));
    fireEvent.click(screen.getByText('پاک کردن'));
    expect(onChange.mock.calls[0]![0].target.value).toBe('');
  });
});
