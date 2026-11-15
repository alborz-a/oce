// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Each admin photo tile is a real link to the photo gallery.
 *
 * The tile is an anchor to /photos. Clicking it also sets the active project
 * before the navigation, so the gallery opens scoped to the photo's project.
 *
 * Run:  npx vitest run src/features/dashboard/__tests__/LatestSitePhotosCard.link.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { useProjectContextStore } from '@/stores/useProjectContextStore';

const PHOTO = {
  id: 'ph-1',
  project_id: 'p-alpha',
  project_name: 'Alpha Tower',
  caption: 'Level 3 slab',
  category: 'progress',
  taken_at: null,
  created_at: '2026-11-01T08:00:00Z',
  file_url: '/v1/documents/photos/ph-1/thumb',
};

vi.mock('@/shared/lib/api', () => ({
  apiGet: () => Promise.resolve([PHOTO]),
}));

// The real AuthImage fetches the thumbnail with a bearer token. It is not
// under test here, so it renders nothing.
vi.mock('@/shared/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/ui')>()),
  AuthImage: () => null,
}));

import { LatestSitePhotosCard } from '../components/LatestSitePhotosCard';

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LatestSitePhotosCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('latest site photo tiles are links to the gallery', () => {
  beforeEach(() => {
    useProjectContextStore.setState({ activeProjectId: null, activeProjectName: '' });
  });

  it('renders each photo tile as an anchor to /photos', async () => {
    const { container } = renderCard();
    await waitFor(() => expect(container.querySelector('a[href="/photos"]')).not.toBeNull());
    const tile = container.querySelector('a[href="/photos"]') as HTMLAnchorElement;
    expect(tile.textContent).toContain('Alpha Tower');
    expect(container.querySelectorAll('a a').length).toBe(0);
  });

  it('selects the photo project before the gallery opens', async () => {
    const { container } = renderCard();
    await waitFor(() => expect(container.querySelector('a[href="/photos"]')).not.toBeNull());
    fireEvent.click(container.querySelector('a[href="/photos"]') as HTMLElement);
    expect(useProjectContextStore.getState().activeProjectId).toBe(PHOTO.project_id);
    expect(useProjectContextStore.getState().activeProjectName).toBe(PHOTO.project_name);
  });
});
