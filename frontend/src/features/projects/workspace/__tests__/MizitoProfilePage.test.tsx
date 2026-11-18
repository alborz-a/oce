// O21: profile and change-password render inside the Mizito shell.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MizitoProfilePage } from '../components/MizitoProfilePage';

vi.mock('@/features/profile/ProfilePage', () => ({
  ProfilePage: () => <div>profile-body</div>,
}));
vi.mock('@/features/projects/api', () => ({
  projectsApi: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../components/ProjectGroupSwitcherSidebar', () => ({
  ProjectGroupSwitcherSidebar: () => <aside data-testid="switcher" />,
  usePinnedProjects: () => ({ pinnedIds: [], togglePin: () => {} }),
}));

describe('MizitoProfilePage', () => {
  it('renders ProfilePage inside the Mizito shell', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/profile']}>
          <MizitoProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const shell = screen.getByTestId('mizito-profile');
    expect(shell.classList.contains('mizito-workspace-light')).toBe(true);
    expect(screen.getByTestId('switcher')).toBeTruthy();
    expect(shell.textContent).toContain('profile-body');
  });
});
