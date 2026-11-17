import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoGlobalTopBar } from '@/features/projects/workspace/components/MizitoGlobalTopBar';

describe('MizitoGlobalTopBar', () => {
  it('shows the logo and brand name as a dropdown trigger, with hamburger far right', () => {
    const onMenuClick = vi.fn();
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={onMenuClick} />
      </MemoryRouter>,
    );

    const brand = screen.getByTestId('mizito-brand');
    expect(brand.querySelector('svg, img')).not.toBeNull();
    expect(brand).toHaveAttribute('aria-haspopup', 'menu');
    expect(brand).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('رویال استارز')).toHaveClass('truncate', 'whitespace-nowrap');

    fireEvent.click(screen.getByRole('button', { name: 'منو' }));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it('opens the brand menu with profile and logout items', () => {
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mizito-brand'));
    expect(screen.getByTestId('mizito-brand')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'پروفایل' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'خروج' })).toBeInTheDocument();
  });
});
