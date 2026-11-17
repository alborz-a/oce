import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoGlobalTopBar } from '@/features/projects/workspace/components/MizitoGlobalTopBar';

describe('MizitoGlobalTopBar app menu access', () => {
  it('offers the OCE app menu inside the brand dropdown', () => {
    const onOpenAppMenu = vi.fn();
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={vi.fn()} onOpenAppMenu={onOpenAppMenu} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mizito-brand'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'منوی برنامه' }));
    expect(onOpenAppMenu).toHaveBeenCalledTimes(1);
  });

  it('hides the app menu item when no handler is passed', () => {
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mizito-brand'));
    expect(screen.queryByRole('menuitem', { name: 'منوی برنامه' })).toBeNull();
  });
});
