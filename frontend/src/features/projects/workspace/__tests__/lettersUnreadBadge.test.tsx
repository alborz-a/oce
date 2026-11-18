import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoNav } from '../components/MizitoNav';
import { useLettersUnreadCount } from '../hooks/useLettersUnreadCount';

vi.mock('../hooks/useLettersUnreadCount', () => ({
  useLettersUnreadCount: vi.fn(() => 2),
}));

/** Same wiring as ProjectGroupSwitcherSidebar: hook value flows into MizitoNav counts.letters. */
function NavWithUnreadLetters() {
  const letters = useLettersUnreadCount();
  return <MizitoNav counts={{ letters }} />;
}

describe('letters unread badge', () => {
  it('shows «۲» on the letters nav item when the hook returns 2', () => {
    render(
      <MemoryRouter>
        <NavWithUnreadLetters />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('mz-nav-badge-letters')).toHaveTextContent('۲');
  });
});
