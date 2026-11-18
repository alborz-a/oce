import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoGlobalTopBar } from '@/features/projects/workspace/components/MizitoGlobalTopBar';

describe('MizitoGlobalTopBar', () => {
  it('shows the logo and plain brand title (no dropdown), with the single hamburger', () => {
    const onMenuClick = vi.fn();
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={onMenuClick} />
      </MemoryRouter>,
    );

    const brand = screen.getByTestId('mizito-brand');
    expect(brand.querySelector('img')).not.toBeNull();
    expect(brand.querySelector('button')).toBeNull();
    expect(brand).not.toHaveAttribute('aria-haspopup');
    expect(screen.getByText('رویال استارز')).toHaveClass('truncate', 'whitespace-nowrap');
    expect(screen.getAllByRole('button', { name: 'منو' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'منو' }));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it('opens the avatar user menu with profile and logout items only', () => {
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    const avatar = screen.getByTestId('mizito-avatar');
    expect(avatar).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(avatar);
    expect(avatar).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'پروفایل' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'خروج' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'منوی برنامه' })).toBeNull();
  });
});
