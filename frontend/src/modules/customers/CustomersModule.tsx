import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAccounts, type Account } from '@/features/crm/api';
import { MzIcon } from '@/features/projects/workspace/components/MzIcon';
import { MizitoPageShell } from '@/modules/_shared/MizitoPageShell';

export function CustomersModule() {
  const accountsQuery = useQuery({
    queryKey: ['customers-accounts'],
    queryFn: () => listAccounts({ limit: 200 }),
  });
  const accounts: Account[] = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((a) =>
      [a.name, a.industry ?? '', a.country ?? '', a.status]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [accounts, search]);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  return (
    <MizitoPageShell navActiveTo="/customers" testId="mizito-customers">
      <section className="flex h-full flex-col gap-3 p-4" data-testid="customers-page">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-[18px] font-semibold text-[#1f2937]">پرونده مشتریان</h1>
          <label className="relative block w-64 max-w-full">
            <span className="sr-only">جستجوی مشتری</span>
            <MzIcon name="search" size={16} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-[#607d8b]" />
            <input
              type="search"
              data-testid="customers-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام، صنعت، کشور"
              className="w-full rounded-md border border-[#e5e7eb] py-1.5 ps-8 pe-2 text-[13px]"
            />
          </label>
        </header>

        {accountsQuery.isLoading ? <p className="py-6 text-center text-[13px] text-[#607d8b]">در حال بارگذاری…</p> : null}

        {!accountsQuery.isLoading && accounts.length === 0 ? (
          <p data-testid="customers-empty" className="py-10 text-center text-[13px] text-[#607d8b]">
            مشتری‌ای ثبت نشده است
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 gap-4">
          <ul className="flex-1 space-y-2 overflow-y-auto" data-testid="customers-list">
            {filtered.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  data-testid={`customer-row-${a.id}`}
                  aria-pressed={selectedId === a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-start ${selectedId === a.id ? 'border-[#1f5c88]' : 'border-[#e5e7eb]'}`}
                >
                  <span>
                    <span className="block text-[14px] font-semibold text-[#1f2937]">{a.name}</span>
                    <span className="block text-[12px] text-[#607d8b]">{a.industry || 'بدون صنعت'}</span>
                  </span>
                  <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[11.5px] text-[#4b5563]">{a.status}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <aside data-testid="customer-detail" className="hidden w-80 shrink-0 space-y-2 rounded-lg border border-[#e5e7eb] bg-white p-4 md:block">
              <h2 className="text-[15px] font-semibold text-[#1f2937]">{selected.name}</h2>
              <dl className="space-y-1 text-[12.5px] text-[#4b5563]">
                <div><dt className="inline text-[#607d8b]">صنعت: </dt><dd className="inline">{selected.industry || '—'}</dd></div>
                <div><dt className="inline text-[#607d8b]">کشور: </dt><dd className="inline">{selected.country || '—'}</dd></div>
                <div><dt className="inline text-[#607d8b]">وب‌سایت: </dt><dd className="inline">{selected.website || '—'}</dd></div>
                <div><dt className="inline text-[#607d8b]">وضعیت: </dt><dd className="inline">{selected.status}</dd></div>
              </dl>
              {selected.description ? <p className="text-[12.5px] whitespace-pre-wrap text-[#4b5563]">{selected.description}</p> : null}
            </aside>
          ) : null}
        </div>
      </section>
    </MizitoPageShell>
  );
}
