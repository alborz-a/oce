// Staff (editor/viewer) lockdown: no OCE page renders, not even for one frame,
// for every OCE-only route declared in App.tsx. The route list is read from
// App.tsx itself, so a new route is covered without editing this test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RestrictedRouteGuard } from '../RestrictedRouteGuard';
import { isNormalUserRouteAllowed } from '../normalUserRoutes';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

vi.mock('@/features/projects/api', () => ({
  projectsApi: {
    list: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Project 1' }]),
  },
}));

// Routes outside AppShell (public, magic-link or auth pages). The guard does not
// wrap them, so they are not part of the shell lockdown.
const OUTSIDE_SHELL = /^\/(share|buyer-portal|tendering|portal|field|login|login-next|register|forgot-password|auth|onboarding)(\/|$)/;

// Vitest runs from frontend/, so App.tsx is resolved from the working directory.
const appSource = readFileSync(resolve(process.cwd(), 'src/app/App.tsx'), 'utf8');
const declared = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]!);
const concrete = (p: string) => p.replace(/:[A-Za-z]+/g, 'p1');
const ocePaths = [...new Set(declared)]
  .filter((p) => p !== '*' && !OUTSIDE_SHELL.test(p))
  .map(concrete)
  .filter((p) => !isNormalUserRouteAllowed(p));

const staffAllowed = ['/projects', '/projects/p1', '/projects/p1/correspondence', '/correspondence', '/colleagues', '/profile', '/notes'];

type Hit = { path: string };
let hits: Hit[] = [];
let visited: string[] = [];

function Spy() {
  const { pathname } = useLocation();
  hits.push({ path: pathname });
  return <div>PAGE {pathname}</div>;
}
function Probe() {
  visited.push(useLocation().pathname);
  return null;
}
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Probe />
              <RestrictedRouteGuard>
                <Spy />
              </RestrictedRouteGuard>
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  hits = [];
  visited = [];
  useAuthStore.setState({ isAuthenticated: true, restrictedMode: false, userRole: 'editor' });
  useProjectContextStore.setState({ activeProjectId: null });
});

describe('staff lockdown: route classification', () => {
  it('finds the OCE-only routes in App.tsx', () => {
    expect(ocePaths.length).toBeGreaterThan(100);
    expect(ocePaths).toContain('/projects/p1/bim');
    expect(ocePaths).toContain('/admin/permissions');
  });
});

describe('staff lockdown: direct URL to OCE-only route', () => {
  it.each(ocePaths)('%s: OCE page never rendered, staff sent to shell home', async (path) => {
    renderAt(path);
    await waitFor(() => expect(visited[visited.length - 1]).toMatch(/^\/projects(\/p1)?$/));
    expect(hits.some((h) => h.path === path)).toBe(false);
  });

  it.each(ocePaths.slice(0, 40))('%s: nothing paints while role is unknown', (path) => {
    useAuthStore.setState({ userRole: null });
    const { container } = renderAt(path);
    expect(hits.length).toBe(0);
    expect(container.textContent).toBe('');
    useAuthStore.setState({ userRole: 'viewer' });
    expect(hits.some((h) => h.path === path)).toBe(false);
  });
});

describe('staff lockdown: shell routes stay open', () => {
  it.each(staffAllowed)('%s renders for staff', (path) => {
    renderAt(path);
    expect(hits.some((h) => h.path === path)).toBe(true);
  });
});
