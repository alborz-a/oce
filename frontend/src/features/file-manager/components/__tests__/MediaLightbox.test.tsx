// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * E4 (rsd-rsc#89) regression guard: both MediaLightbox and PhotosTab lightboxes
 * must portal directly into document.body and avoid h-[100dvh] / w-screen, so a
 * transformed or fixed-sidebar ancestor never creates an offset white strip.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/features/file-manager/hooks', () => ({
  useFileList: vi.fn(),
}));

vi.mock('@/features/file-manager/components/UploadDialog', () => ({
  UploadDialog: () => null,
}));

import { useFileList } from '@/features/file-manager/hooks';
import { MediaLightbox } from '../MediaLightbox';
import { PhotosTab } from '@/features/projects/PhotosTab';

describe('Lightbox portal & white-strip guard (E4)', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => new Blob(['x'], { type: 'image/jpeg' }),
      }),
    );
    if (!('createObjectURL' in URL)) {
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = () => '';
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-photo');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('portals MediaLightbox directly to document.body outside transformed ancestors', async () => {
    render(
      <div data-testid="transformed-host" style={{ transform: 'translateX(120px)' }}>
        <MediaLightbox
          open
          index={0}
          onClose={() => {}}
          items={[
            {
              id: 'photo-1',
              name: 'site.jpg',
              kind: 'photo',
              extension: '.jpg',
              mime_type: 'image/jpeg',
              download_url: '/api/v1/documents/photos/photo-1/file/',
              thumbnail_url: '/api/v1/documents/photos/photo-1/thumb/',
            },
          ]}
        />
      </div>,
    );

    const dialog = await screen.findByTestId('media-lightbox');
    const host = screen.getByTestId('transformed-host');
    expect(dialog.parentElement).toBe(document.body);
    expect(host.contains(dialog)).toBe(false);
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('inset-0');
    expect(dialog.className).not.toContain('h-[100dvh]');
    expect(dialog.className).not.toContain('w-screen');
    expect(document.documentElement.hasAttribute('data-media-lightbox')).toBe(true);
  });

  it('portals PhotosTab lightbox directly to document.body without h-[100dvh] or w-screen', async () => {
    (useFileList as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        project_id: 'proj-1',
        total: 1,
        limit: 500,
        offset: 0,
        items: [
          {
            id: 'photo-1',
            kind: 'photo',
            name: 'site.jpg',
            project_id: 'proj-1',
            size_bytes: 1024,
            mime_type: 'image/jpeg',
            extension: 'jpg',
            modified_at: '2026-05-01T10:00:00Z',
            physical_path: '/p/photo-1.jpg',
            relative_path: 'photo-1.jpg',
            storage_backend: 'local',
            download_url: '/api/v1/documents/photos/photo-1/file/',
            preview_url: '/api/v1/documents/photos/photo-1/file/',
            thumbnail_url: '/api/v1/documents/photos/photo-1/thumb/',
            discipline: null,
            category: null,
            extra: {},
          },
        ],
      },
      isLoading: false,
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <div data-testid="transformed-host" style={{ transform: 'translateX(120px)' }}>
            <PhotosTab projectId="proj-1" />
          </div>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('photos-tab-tile-photo-1'));

    const dialog = await waitFor(() => screen.getByTestId('photos-tab-lightbox'));
    const host = screen.getByTestId('transformed-host');
    expect(dialog.parentElement).toBe(document.body);
    expect(host.contains(dialog)).toBe(false);
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('inset-0');
    expect(dialog.className).not.toContain('h-[100dvh]');
    expect(dialog.className).not.toContain('w-screen');
  });
});
