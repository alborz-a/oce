// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * C3 (rsd-rsc#86) regression guard: FilePreviewPane hides the Kind row for
 * photos (showing the field-report tag only) while continuing to render Kind
 * for regular documents.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/shared/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/api')>('@/shared/lib/api');
  const empty = () => Object.assign([], { items: [], total: 0 });
  return {
    ...actual,
    apiGet: vi.fn(async () => empty()),
    apiPost: vi.fn(async () => empty()),
    apiPatch: vi.fn(async () => empty()),
    apiDelete: vi.fn(async () => empty()),
  };
});

import { FilePreviewPane } from '../FilePreviewPane';
import type { FileRow } from '../../types';

function makeRow(overrides: Partial<FileRow>): FileRow {
  return {
    id: 'file-1',
    kind: 'document',
    name: 'plans.pdf',
    project_id: 'proj-1',
    size_bytes: 2048,
    mime_type: 'application/pdf',
    extension: '.pdf',
    modified_at: '2026-05-20T08:00:00Z',
    physical_path: '/uploads/plans.pdf',
    relative_path: 'plans.pdf',
    storage_backend: 'local',
    download_url: null,
    preview_url: null,
    thumbnail_url: null,
    discipline: null,
    category: null,
    extra: {},
    ...overrides,
  };
}

function renderPane(row: FileRow) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/files']}>
      <QueryClientProvider client={client}>
        <FilePreviewPane row={row} onClose={() => {}} onEmail={() => {}} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('FilePreviewPane photo Kind row guard (C3)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('hides the Kind row and displays the field-report tag for photos', () => {
    renderPane(
      makeRow({
        id: 'photo-1',
        kind: 'photo',
        name: 'site_photo.jpg',
        mime_type: 'image/jpeg',
        extension: '.jpg',
      }),
    );

    expect(screen.queryByText(/^Kind$/i)).not.toBeInTheDocument();
    expect(screen.getByText('برچسب گزارش‌های میدانی')).toBeInTheDocument();
  });

  it('still displays the Kind row for document rows', () => {
    renderPane(makeRow({ id: 'doc-1', kind: 'document' }));

    expect(screen.getByText(/^Kind$/i)).toBeInTheDocument();
  });
});
