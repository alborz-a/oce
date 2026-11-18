import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProjectGroupSwitcherSidebar } from '../components/ProjectGroupSwitcherSidebar';
import { WorkspaceDmContext, type WorkspaceDmValue } from '../context/WorkspaceDmContext';
import type { WorkspaceMember } from '../types';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

const members: WorkspaceMember[] = [
  { user_id: 'u-me', email: 'me@royalstars.co', full_name: 'کاربر من', role: 'member', is_owner: false },
  { user_id: 'u-2', email: 'maryam@royalstars.co', full_name: 'محبوبه کرامت', role: 'member', is_owner: false },
];

describe('ProjectGroupSwitcherSidebar new-DM picker', () => {
  it('lists colleagues without self and selecting one calls openDm', () => {
    const openDm = vi.fn(async () => {});
    const value: WorkspaceDmValue = { openDm };
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkspaceDmContext.Provider value={value}>
            <ProjectGroupSwitcherSidebar
              projects={[]}
              activeProjectId="p-1"
              onSelectProject={() => {}}
              currentUserId="u-me"
              members={members}
            />
          </WorkspaceDmContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId('switcher-new-dm-picker')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('switcher-new-dm-trigger'));

    const picker = screen.getByTestId('switcher-new-dm-picker');
    expect(picker).toBeInTheDocument();
    expect(screen.getByPlaceholderText('نام کاربر را وارد نمایید')).toBeInTheDocument();
    expect(screen.queryByTestId('switcher-new-dm-option-u-me')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('switcher-new-dm-option-u-2'));

    expect(openDm).toHaveBeenCalledWith('u-2');
    expect(screen.queryByTestId('switcher-new-dm-picker')).not.toBeInTheDocument();
  });
});
