// O21: Mizito-only landing and routes for normal users (role not admin/manager).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RestrictedRouteGuard } from '../RestrictedRouteGuard';
import { isNormalUserRouteAllowed } from '../normalUserRoutes';
import { isNormalUserRole, isEngineeringRole } from '@/shared/lib/systemAdmin';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

vi.mock('@/features/projects/api', () => ({
  projectsApi: { list: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Project 1' }]) },
}));

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <RestrictedRouteGuard>
              <div>page-content</div>
              <LocationProbe />
            </RestrictedRouteGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: true, restrictedMode: false, userRole: 'viewer' });
  useProjectContextStore.setState({ activeProjectId: 'proj-123' });
});

describe('role helpers', () => {
  it('admin and manager are engineering roles, others are normal users', () => {
    expect(isEngineeringRole('admin')).toBe(true);
    expect(isEngineeringRole('Manager')).toBe(true);
    expect(isNormalUserRole('admin')).toBe(false);
    expect(isNormalUserRole('manager')).toBe(false);
    expect(isNormalUserRole('viewer')).toBe(true);
    expect(isNormalUserRole('editor')).toBe(true);
  });

  it('unknown role is not treated as normal yet', () => {
    expect(isNormalUserRole(null)).toBe(false);
    expect(isNormalUserRole('')).toBe(false);
  });
});

describe('normal user route allowlist', () => {
  it('allows the Mizito workspace, correspondence and profile', () => {
    expect(isNormalUserRouteAllowed('/projects/p1')).toBe(true);
    expect(isNormalUserRouteAllowed('/projects/p1/correspondence')).toBe(true);
    expect(isNormalUserRouteAllowed('/correspondence')).toBe(true);
    expect(isNormalUserRouteAllowed('/profile')).toBe(true);
    expect(isNormalUserRouteAllowed('/projects')).toBe(true);
    expect(isNormalUserRouteAllowed('/colleagues')).toBe(true);
    expect(isNormalUserRouteAllowed('/colleagues/abc')).toBe(true);
  });

  it('blocks OCE main-menu pages', () => {
    expect(isNormalUserRouteAllowed('/')).toBe(false);
    expect(isNormalUserRouteAllowed('/settings')).toBe(false);
    expect(isNormalUserRouteAllowed('/projects/new')).toBe(false);
    expect(isNormalUserRouteAllowed('/projects/p1/tasks')).toBe(false);
    expect(isNormalUserRouteAllowed('/photos')).toBe(false);
  });
});

describe('RestrictedRouteGuard for normal users', () => {
  it('redirects a normal user from / to the active Mizito project', () => {
    renderAt('/');
    expect(screen.getByTestId('loc').textContent).toBe('/projects/proj-123');
    expect(screen.queryByText('page-content')).toBeNull();
  });

  it('keeps a normal user off OCE pages', () => {
    renderAt('/settings');
    expect(screen.getByTestId('loc').textContent).toBe('/projects/proj-123');
  });

  it('lets a normal user into the Mizito workspace', () => {
    renderAt('/projects/p1');
    expect(screen.getByText('page-content')).toBeTruthy();
  });

  it('admin keeps / (guard does not redirect)', () => {
    useAuthStore.setState({ userRole: 'admin', restrictedMode: false });
    renderAt('/');
    expect(screen.getByText('page-content')).toBeTruthy();
    expect(screen.getByTestId('loc').textContent).toBe('/');
  });
});
