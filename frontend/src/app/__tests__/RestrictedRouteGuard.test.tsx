// [RSC-IRAN] Unit tests for RestrictedRouteGuard (Step 5.4, 5.7)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RestrictedRouteGuard } from '../RestrictedRouteGuard';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

vi.mock('@/features/projects/api', () => ({
  projectsApi: {
    list: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Project 1' }]),
  },
}));

beforeEach(() => {
  useAuthStore.setState({
    isAuthenticated: true,
    restrictedMode: true,
    userRole: 'editor',
  });
  useProjectContextStore.setState({
    activeProjectId: null,
  });
});

describe('RestrictedRouteGuard', () => {
  it('renders children when route is allowed', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <RestrictedRouteGuard>
          <div>Photos Content</div>
        </RestrictedRouteGuard>
      </MemoryRouter>,
    );
    expect(screen.getByText('Photos Content')).toBeTruthy();
  });

  it('redirects to active project when route is disallowed', () => {
    useProjectContextStore.setState({ activeProjectId: 'proj-123' });
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route
            path="/onboarding"
            element={
              <RestrictedRouteGuard>
                <div>Onboarding Content</div>
              </RestrictedRouteGuard>
            }
          />
          <Route path="/projects/proj-123" element={<div>Project 123 Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Onboarding Content')).toBeNull();
    expect(screen.getByText('Project 123 Page')).toBeTruthy();
  });

  it('redirects to first project when route is disallowed and no active project', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RestrictedRouteGuard>
                <div>Dashboard Content</div>
              </RestrictedRouteGuard>
            }
          />
          <Route path="/projects/p1" element={<div>First Project Page</div>} />
          <Route path="/projects" element={<div>Projects List</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('First Project Page')).toBeTruthy();
    });
    expect(screen.queryByText('Dashboard Content')).toBeNull();
  });
});
