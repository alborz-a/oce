import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoNav } from '../components/MizitoNav';

describe('MizitoNav badges', () => {
  it('renders the overdue (red) and open (green) task pills as Persian digits when count > 0', () => {
    render(
      <MemoryRouter>
        <MizitoNav counts={{ taskOverdue: 2, taskOpen: 3 }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('mz-nav-badge-task-overdue')).toHaveTextContent('۲');
    expect(screen.getByTestId('mz-nav-badge-task-overdue')).toHaveClass('mz-nav-badge--red');
    expect(screen.getByTestId('mz-nav-badge-task-open')).toHaveTextContent('۳');
    expect(screen.getByTestId('mz-nav-badge-task-open')).toHaveClass('mz-nav-badge--green');
    expect(screen.queryByTestId('mz-nav-badge-projects')).toBeNull();
    expect(screen.queryByTestId('mz-nav-badge-letters')).toBeNull();
  });

  it('hides each task pill when its count is 0', () => {
    render(
      <MemoryRouter>
        <MizitoNav counts={{ taskOverdue: 0, taskOpen: 4 }} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('mz-nav-badge-task-overdue')).toBeNull();
    expect(screen.getByTestId('mz-nav-badge-task-open')).toHaveTextContent('۴');
  });

  it('renders no task pills when counts are absent', () => {
    render(
      <MemoryRouter>
        <MizitoNav />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('mz-nav-badge-task-overdue')).toBeNull();
    expect(screen.queryByTestId('mz-nav-badge-task-open')).toBeNull();
  });
});
