import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RestrictedRouteGuard } from '@/app/RestrictedRouteGuard';
import { isRestrictedRouteAllowed } from '@/app/restrictedRoutes';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

vi.mock('@/features/projects/api', () => ({
  projectsApi: {
    list: vi.fn().mockResolvedValue([{ id: 'other-project', name: 'Other' }]),
  },
}));

const ROUTE_PROJECT = '1642ffa3-22af-4830-95ce-2e00290cc1a2';

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: true, restrictedMode: true, userRole: 'editor' });
  useProjectContextStore.setState({ activeProjectId: 'other-project' });
});

describe('correspondence route keeps the URL project', () => {
  it('allows the restricted-mode correspondence route for any project id', () => {
    expect(isRestrictedRouteAllowed(`/projects/${ROUTE_PROJECT}/correspondence`)).toBe(true);
    expect(isRestrictedRouteAllowed(`/projects/${ROUTE_PROJECT}/correspondence?x=1`)).toBe(true);
  });

  it('renders the route without redirecting to the stored active project', () => {
    render(
      <MemoryRouter initialEntries={[`/projects/${ROUTE_PROJECT}/correspondence`]}>
        <Routes>
          <Route
            path="/projects/:projectId/correspondence"
            element={
              <RestrictedRouteGuard>
                <div>Correspondence Content</div>
              </RestrictedRouteGuard>
            }
          />
          <Route path="/projects/other-project" element={<div>Other Project Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Correspondence Content')).toBeTruthy();
    expect(screen.queryByText('Other Project Page')).toBeNull();
  });
});
