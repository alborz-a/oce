// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
//
// Job-title edit on the user management page: the edit button opens the
// modal prefilled with the current title, typing and saving calls the admin
// PATCH (updateUser) with { job_title }, and the list is refreshed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mockFetchUsers = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    fetchUsers: (...args: unknown[]) => mockFetchUsers(...args),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    getUserModuleAccess: vi.fn(),
    setUserModuleAccess: vi.fn(),
  };
});

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(async () => ({ id: 'me-1', email: 'me@example.com', full_name: 'Me' })),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/shared/lib/permissionGates', () => ({
  useHasPermission: () => true,
}));

import { UserManagementPage } from './UserManagementPage';

const USER = {
  id: 'u-1',
  email: 'ali@example.com',
  full_name: 'علی رضایی',
  role: 'editor' as const,
  locale: 'fa-ir',
  is_active: true,
  last_login_at: null,
  timezone: 'Asia/Tehran',
  job_title: 'مدیر فروش',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('user job title edit', () => {
  beforeEach(() => {
    mockFetchUsers.mockReset();
    mockUpdateUser.mockReset();
    mockFetchUsers.mockResolvedValue([USER]);
    mockUpdateUser.mockResolvedValue({ ...USER, job_title: 'مدیر فنی' });
  });

  it('shows the current job title under the name', async () => {
    renderPage();
    expect(await screen.findByText('مدیر فروش')).toBeInTheDocument();
  });

  it('opens the modal prefilled, saves via PATCH with { job_title }', async () => {
    const user = userEvent.setup();
    renderPage();

    const editButton = await screen.findByTestId('edit-job-title');
    await user.click(editButton);

    const input = await screen.findByLabelText('عنوان شغلی');
    expect(input).toHaveValue('مدیر فروش');

    await user.clear(input);
    await user.type(input, 'مدیر فنی');
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u-1', { job_title: 'مدیر فنی' });
    });
    await waitFor(() => {
      expect(mockFetchUsers).toHaveBeenCalledTimes(2);
    });
  });

  it('cancel closes the modal without calling PATCH', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('edit-job-title'));
    await user.click(await screen.findByRole('button', { name: 'انصراف' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('عنوان شغلی')).not.toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
