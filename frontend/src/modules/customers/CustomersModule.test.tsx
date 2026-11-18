import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CustomersModule } from './CustomersModule';
import { listAccounts, type Account } from '@/features/crm/api';

vi.mock('@/modules/_shared/MizitoPageShell', () => ({
  MizitoPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/crm/api', () => ({
  listAccounts: vi.fn(),
}));

const account = (id: string, name: string, industry: string | null): Account =>
  ({
    id,
    name,
    industry,
    size_category: 'small',
    country: 'IR',
    website: null,
    primary_contact_id: null,
    description: 'توضیح',
    status: 'active',
    owner_user_id: null,
    tags: [],
    created_at: '2026-11-18T00:00:00Z',
    updated_at: '2026-11-18T00:00:00Z',
  }) as unknown as Account;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CustomersModule />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomersModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty message when there are no accounts', async () => {
    vi.mocked(listAccounts).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId('customers-empty')).toHaveTextContent('مشتری‌ای ثبت نشده است');
  });

  it('filters rows by the client-side search box', async () => {
    vi.mocked(listAccounts).mockResolvedValue([account('a1', 'شرکت آلفا', 'ساخت'), account('a2', 'بتا', 'نفت')]);
    renderPage();
    expect(await screen.findByTestId('customer-row-a1')).toBeInTheDocument();
    expect(screen.getByTestId('customer-row-a2')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('customers-search'), { target: { value: 'آلفا' } });
    expect(screen.getByTestId('customer-row-a1')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-row-a2')).toBeNull();
  });

  it('opens a read-only detail panel when a row is clicked', async () => {
    vi.mocked(listAccounts).mockResolvedValue([account('a1', 'شرکت آلفا', 'ساخت')]);
    renderPage();
    fireEvent.click(await screen.findByTestId('customer-row-a1'));
    expect(screen.getByTestId('customer-detail')).toHaveTextContent('شرکت آلفا');
    expect(screen.queryByRole('button', { name: /ذخیره|حذف/ })).toBeNull();
  });
});
