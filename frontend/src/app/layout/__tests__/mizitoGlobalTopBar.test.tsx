import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoGlobalTopBar } from '@/features/projects/workspace/components/MizitoGlobalTopBar';

describe('MizitoGlobalTopBar mobile brand', () => {
  it('shows the logo and a single-line title on mobile, and keeps the desktop company name md-only', () => {
    render(
      <MemoryRouter>
        <MizitoGlobalTopBar onMenuClick={vi.fn()} />
      </MemoryRouter>,
    );

    const brand = screen.getByTestId('mizito-mobile-brand');
    expect(brand.className).toContain('md:hidden');
    expect(brand.querySelector('svg, img')).not.toBeNull();

    const title = screen.getByText('رویال استارز');
    expect(title.className).toContain('whitespace-nowrap');
    expect(title.className).toContain('truncate');
    expect(title.tagName).toBe('SPAN');

    const companyName = screen.getByText('OCE');
    expect(companyName.className).toContain('hidden');
    expect(companyName.className).toContain('md:block');
  });
});
