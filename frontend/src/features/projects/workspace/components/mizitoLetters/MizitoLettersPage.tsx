import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MzIcon } from '../MzIcon';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import type { LetterListItem, MailboxBox, MailboxFilters } from './lettersApi';
import { useMailbox } from './useLetters';
import { formatLetterDate, formatLetterDateTime } from './lettersFormat';
import { MizitoLetterDetail } from './MizitoLetterDetail';
import { MizitoComposeLetterModal } from './MizitoComposeLetterModal';

/** Tabs in spec order. «برچسب‌ها» is a dropdown (no mailbox box), kept as a visual tab for now. */
const TABS: { key: MailboxBox | 'labels'; label: string }[] = [
  { key: 'inbox', label: 'صندوق ورودی' },
  { key: 'outbox', label: 'صندوق خروجی' },
  { key: 'paraph', label: 'پاراف‌های من' },
  { key: 'labels', label: 'برچسب‌ها' },
  { key: 'archived', label: 'ورودی آرشیو شده' },
];

function senderLabel(item: LetterListItem): string {
  if (item.direction === 'outgoing') {
    const names = item.recipients.map((r) => r.name).filter(Boolean);
    return names.length ? `من، ${names.join('، ')}` : 'من';
  }
  return item.sender_name;
}

export function MizitoLettersPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('letter');
  const [box, setBox] = useState<MailboxBox>('inbox');
  const [filters, setFilters] = useState<MailboxFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const mailbox = useMailbox(box, { limit: 50, ...filters });
  const items = mailbox.data?.items ?? [];

  if (selectedId) {
    return (
      <MizitoLetterDetail
        letterId={selectedId}
        onBack={() => setParams({}, { replace: false })}
      />
    );
  }

  const openLetter = (id: string) => setParams({ letter: id });

  return (
    <div className="mz-letters" data-testid="mizito-letters-page">
      <header className="mz-letters-head">
        <h1 className="mz-letters-title">کارتابل</h1>
        <nav className="mz-letters-tabs" role="tablist" aria-label="صندوق‌های نامه">
          {TABS.map((t) => {
            const active = t.key !== 'labels' && t.key === box;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`letters-tab-${t.key}`}
                className={`mz-letters-tab${active ? ' is-active' : ''}`}
                onClick={() => {
                  if (t.key !== 'labels') setBox(t.key);
                }}
              >
                {t.label}
                {t.key === 'labels' ? <MzIcon name="arrow_drop_down" size={18} /> : null}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="mz-letters-toolbar">
        <button
          type="button"
          className="mz-letters-compose"
          data-testid="letters-compose-btn"
          onClick={() => setComposeOpen(true)}
        >
          <MzIcon name="add" size={18} />
          <span>ایجاد نامه</span>
        </button>
        <button
          type="button"
          className="mz-letters-filter-toggle"
          data-testid="letters-filter-toggle"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((v) => !v)}
        >
          <MzIcon name="filter_list" size={18} />
          <span>فیلتر نمایش نامه‌ها</span>
        </button>
      </div>

      {filterOpen ? (
        <div className="mz-letters-filter-panel" data-testid="letters-filter-panel">
          <label>
            <span>متن موضوع</span>
            <input
              type="text"
              value={filters.q ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))}
            />
          </label>
          <label>
            <span>از</span>
            <input
              type="date"
              value={filters.from ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
            />
          </label>
          <label>
            <span>تا</span>
            <input
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
            />
          </label>
          <label className="mz-letters-filter-unread">
            <input
              type="checkbox"
              checked={Boolean(filters.unread)}
              onChange={(e) => setFilters((f) => ({ ...f, unread: e.target.checked || undefined }))}
            />
            <span>فقط خوانده‌نشده</span>
          </label>
        </div>
      ) : null}

      <section className="mz-letters-list" aria-label="فهرست نامه‌ها">
        {items.length > 0 ? <div className="mz-letters-group">نامه‌های قدیمی</div> : null}
        {mailbox.isError ? <p className="mz-letters-empty">خطا در بارگذاری نامه‌ها</p> : null}
        {!mailbox.isLoading && !mailbox.isError && items.length === 0 ? (
          <p className="mz-letters-empty" data-testid="letters-empty">
            نامه‌ای وجود ندارد
          </p>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid="letters-row"
            className={`mz-letters-row${item.unread ? ' is-unread' : ''}`}
            onClick={() => openLetter(item.id)}
          >
            <span className="mz-letters-row-sender">
              <UserAvatar url={item.sender_avatar_url} alt={item.sender_name} className="mz-letters-avatar" />
              <span>{senderLabel(item)}</span>
            </span>
            <span className="mz-letters-row-subject">{item.subject}</span>
            <span className="mz-letters-row-meta">
              {item.reference_number ? (
                <span className="mz-letters-badge-registered" data-testid="letters-registered-badge">
                  {`${item.direction === 'outgoing' ? 'صادره' : 'وارده'} | ${formatLetterDate(item.sent_at)} | ${item.reference_number}`}
                </span>
              ) : null}
              <span className="mz-letters-row-date">{formatLetterDateTime(item.sent_at)}</span>
              {item.attachments_count > 0 ? (
                <span className="mz-letters-attach" aria-label="پیوست دارد">
                  <MzIcon name="attach_file" size={16} />
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </section>

      {composeOpen ? <MizitoComposeLetterModal onClose={() => setComposeOpen(false)} /> : null}
    </div>
  );
}
