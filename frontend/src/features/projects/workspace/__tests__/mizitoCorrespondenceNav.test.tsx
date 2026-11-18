import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoNav } from '../components/MizitoNav';
import { MizitoCorrespondencePage } from '../components/MizitoCorrespondencePage';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';

vi.mock('@/features/correspondence/CorrespondencePage', () => ({
  CorrespondencePage: () => <div data-testid="correspondence-body" />,
}));

describe('نامه‌ها nav item target', () => {
  it('links the right-panel «نامه‌ها» item to /correspondence', () => {
    render(
      <MemoryRouter>
        <MizitoNav />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'نامه‌ها' });
    expect(link).toHaveAttribute('href', '/correspondence');
  });

  it('renders the correspondence module inside the Mizito shell and restores chrome on unmount', () => {
    useWorkspaceChromeStore.getState().setActive(false);
    const { unmount } = render(
      <MemoryRouter>
        <MizitoCorrespondencePage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('correspondence-body')).toBeInTheDocument();
    expect(useWorkspaceChromeStore.getState().active).toBe(true);
    unmount();
    expect(useWorkspaceChromeStore.getState().active).toBe(false);
  });
});
