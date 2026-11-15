// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * The restricted (viewer) dashboard: project cards, task rows and photo
 * tiles are links.
 *
 * - Project card: the title is a stretched link to /projects/<id>. The
 *   photo, tasks and chevron links stay on top of it.
 * - Task row: a link to that project's tasks, or /tasks when the task has
 *   no project.
 * - Photo tile: a link to the project's photo tab. Nothing is nested.
 *
 * Run:  npx vitest run src/features/dashboard/__tests__/RestrictedDashboard.links.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const PROJECT = { id: 'p-alpha', name: 'Alpha', status: 'active' };
const TASK = {
  id: 't-1',
  title: 'Pour slab',
  status: 'open',
  priority: 'high',
  project_id: 'p-alpha',
  project_name: 'Alpha',
};
const PHOTO = {
  id: 'ph-1',
  project_id: 'p-alpha',
  project_name: 'Alpha',
  caption: 'Level 3',
  created_at: '2026-11-01T08:00:00Z',
};

vi.mock('@/shared/lib/api', () => ({
  API_BASE: '',
  apiGet: (url: string) => {
    if (url.startsWith('/v1/projects/')) return Promise.resolve([PROJECT]);
    if (url.startsWith('/v1/tasks/my-tasks/')) return Promise.resolve({ items: [TASK] });
    if (url.startsWith('/v1/documents/photos/recent/')) return Promise.resolve([PHOTO]);
    return Promise.resolve([]);
  },
}));

// The real AuthImage fetches the thumbnail with a bearer token. It is not
// under test here, so it renders nothing.
vi.mock('@/shared/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/ui')>()),
  AuthImage: () => null,
}));

import { RestrictedDashboard } from '../RestrictedDashboard';

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RestrictedDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('restricted dashboard tiles are links', () => {
  it('links the project card to its project and keeps the shortcut links', async () => {
    const { container } = renderDashboard();
    await waitFor(() => expect(container.querySelector('a[href="/projects/p-alpha"]')).not.toBeNull());
    expect(container.querySelector('a[href="/projects/p-alpha/tasks"]')).not.toBeNull();
    expect(container.querySelector('a[href="/projects/p-alpha?tab=photos"]')).not.toBeNull();
  });

  it('links each task row to the project tasks page', async () => {
    renderDashboard();
    const title = await screen.findByText('Pour slab');
    expect(title.closest('a')?.getAttribute('href')).toBe('/projects/p-alpha/tasks');
  });

  it('links each photo tile to the project photo tab', async () => {
    const { container } = renderDashboard();
    await waitFor(() =>
      expect(container.querySelector('a[href="/projects/p-alpha?tab=photos"][class*="aspect-4/3"]')).not.toBeNull(),
    );
  });

  it('never nests one anchor inside another', async () => {
    const { container } = renderDashboard();
    await screen.findByText('Pour slab');
    expect(container.querySelectorAll('a a').length).toBe(0);
  });
});
