import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiDelete: mocks.apiDelete,
}));
vi.mock('@/features/projects/api', () => ({
  projectsApi: { update: mocks.update, archive: mocks.archive },
}));

import { ProjectSettingsModal, isGroupAdminRole } from '../components/ProjectSettingsModal';

const MEMBERS = [
  { user_id: 'u-1', email: 'a@x.ir', full_name: 'امیر کبیر', role: 'owner', is_owner: true },
  { user_id: 'u-2', email: 'b@x.ir', full_name: 'عطاء اکبرخانی', role: 'member', is_owner: false },
];

function renderModal(open = true, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (
    <QueryClientProvider client={client}>
      <ProjectSettingsModal open={open} onClose={onClose} projectId="p-1" projectName="امیرکبیر" />
    </QueryClientProvider>
  );
  return { ...render(ui), onClose };
}

describe('ProjectSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue(MEMBERS);
    mocks.update.mockResolvedValue({});
    mocks.archive.mockResolvedValue(undefined);
  });

  it('renders nothing while closed', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });

  it('renders RTL dialog with title, section labels and members with admin badge', async () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'تنظیمات پروژه' });
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('امیرکبیر')).toBeInTheDocument();
    expect(screen.getByText('اعضای پروژه')).toBeInTheDocument();
    expect(screen.getByText('افزودن اعضا')).toBeInTheDocument();
    expect(screen.getByText('آرشیو پروژه')).toBeInTheDocument();
    expect(await screen.findByText('عطاء اکبرخانی')).toBeInTheDocument();
    // Owner gets the badge and no remove button; regular member gets remove.
    expect(screen.getAllByText('مدیر گروه')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'حذف از پروژه' })).toHaveLength(1);
    expect(mocks.apiGet).toHaveBeenCalledWith('/v1/projects/p-1/members/');
  });

  it('renames the project through projectsApi.update', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'ویرایش عنوان' }));
    const input = screen.getByRole('textbox', { name: 'عنوان پروژه' });
    fireEvent.change(input, { target: { value: 'پروژه جدید' } });
    fireEvent.click(screen.getByRole('button', { name: 'تایید' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('p-1', { name: 'پروژه جدید' }));
  });

  it('archives only after the second confirm click', async () => {
    const onClose = vi.fn();
    renderModal(true, onClose);
    fireEvent.click(screen.getByRole('button', { name: 'آرشیو پروژه' }));
    expect(mocks.archive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'تایید آرشیو' }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith('p-1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('isGroupAdminRole maps owner-level roles only', () => {
    expect(isGroupAdminRole({ role: 'owner', is_owner: false })).toBe(true);
    expect(isGroupAdminRole({ role: 'project_manager', is_owner: false })).toBe(true);
    expect(isGroupAdminRole({ role: 'member', is_owner: false })).toBe(false);
  });
});
