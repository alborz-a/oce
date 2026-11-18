import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoGlobalTopBar } from '@/features/projects/workspace/components/MizitoGlobalTopBar';

describe('MizitoGlobalTopBar admin panel access', () => {
  it('does not offer the OCE app menu (admin panel) from the user menu', () => {
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mizito-avatar'));
    expect(screen.queryByRole('menuitem', { name: 'منوی برنامه' })).toBeNull();
    expect(screen.getByTestId('mizito-user-menu')).toBeInTheDocument();
  });
});
