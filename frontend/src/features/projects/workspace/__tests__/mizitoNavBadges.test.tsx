import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoNav } from '../components/MizitoNav';

describe('MizitoNav badges', () => {
  it('renders the tasks badge as Persian digits when count > 0', () => {
    render(
      <MemoryRouter>
        <MizitoNav counts={{ tasks: 3 }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('mz-nav-badge-tasks')).toHaveTextContent('۳');
    expect(screen.queryByTestId('mz-nav-badge-projects')).toBeNull();
    expect(screen.queryByTestId('mz-nav-badge-letters')).toBeNull();
  });

  it('hides the badge when count is 0', () => {
    render(
      <MemoryRouter>
        <MizitoNav counts={{ tasks: 0 }} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('mz-nav-badge-tasks')).toBeNull();
  });
});
