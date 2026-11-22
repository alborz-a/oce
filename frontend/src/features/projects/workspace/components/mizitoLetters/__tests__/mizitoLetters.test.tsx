import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiGet, apiPost } from '@/shared/lib/api';
import { MizitoLettersPage } from '../MizitoLettersPage';
import { MizitoComposeLetterModal } from '../MizitoComposeLetterModal';
import { MizitoLetterDetail } from '../MizitoLetterDetail';
import { sanitizeLetterHtml } from '../lettersSanitize';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  API_BASE: '',
}));

const apiGetMock = vi.mocked(apiGet);
const apiPostMock = vi.mocked(apiPost);

const ITEM_IN = {
  id: 'L1',
  thread_id: 'T1',
  subject: 'درخواست تأیید نقشه',
  snippet: '',
  sender_user_id: 'U2',
  sender_name: 'آرش پیرنیا',
  sender_avatar_url: null,
  recipients: [{ user_id: 'U1', name: 'من' }],
  sent_at: '2026-07-16T14:55:00Z',
  unread: true,
  attachments_count: 2,
  direction: 'incoming',
  reference_number: null,
  labels: [],
};

const ITEM_OUT = {
  ...ITEM_IN,
  id: 'L2',
  subject: 'پاسخ صورت‌جلسه',
  sender_name: 'من',
  recipients: [{ user_id: 'U3', name: 'ابراهیم' }],
  unread: false,
  attachments_count: 0,
  direction: 'outgoing',
  reference_number: 'ق- ۲۳۷ -۴۰۵',
};

function renderWith(ui: React.ReactElement, path = '/correspondence') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/correspondence" element={ui} />
          <Route path="/projects/:projectId/correspondence" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiGetMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/v1/correspondence/mailbox/?')) {
      const box = new URL(`http://x${path}`).searchParams.get('box');
      if (box === 'inbox') return { items: [ITEM_IN, ITEM_OUT], total: 2 };
      if (box === 'outbox') return { items: [ITEM_OUT], total: 1 };
      return { items: [], total: 0 };
    }
    if (path === '/v1/correspondence/mailbox/unread-count/') return { count: 3 };
    if (path === '/v1/users/?limit=100&is_active=true') {
      return [{ id: 'U9', full_name: 'ابراهیم رحمانی', job_title: 'مهندس عمران', avatar_url: null, is_active: true }];
    }
    if (path === '/v1/correspondence/L1/thread/') {
      return {
        subject: 'درخواست تأیید نقشه',
        reference_number: null,
        letter_type: 'incoming',
        registered_at: '2026-07-16T14:55:00Z',
        labels: [],
        messages: [
          {
            id: 'M1',
            sender_user_id: 'U2',
            sender_name: 'آرش پیرنیا',
            sender_avatar_url: null,
            recipients: [{ user_id: 'U1', name: 'من' }],
            body_html: '<p>لطفاً بررسی شود</p><script>alert(1)</script>',
            sent_at: '2026-07-16T14:55:00Z',
            attachments: [{ id: 'A1', name: 'nakhshe.pdf', size: 2048, download_url: '/f/A1' }],
          },
        ],
      };
    }
    return {};
  });
  apiPostMock.mockResolvedValue({});
});

describe('MizitoLettersPage', () => {
  it('renders title, tabs, compose button and inbox rows', async () => {
    renderWith(<MizitoLettersPage />);
    expect(screen.getByText('کارتابل')).toBeTruthy();
    expect(screen.getByTestId('letters-tab-inbox').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('letters-compose-btn').textContent).toContain('ایجاد نامه');
    expect(screen.getByText('فیلتر نمایش نامه‌ها')).toBeTruthy();
    const rows = await screen.findAllByTestId('letters-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains('is-unread')).toBe(true);
    expect(rows[1].textContent).toContain('من، ابراهیم');
    expect(rows[1].textContent).toContain('ق- ۲۳۷ -۴۰۵');
    expect(screen.getByText('نامه‌های قدیمی')).toBeTruthy();
  });

  it('switches mailbox on tab click and refetches with box param', async () => {
    renderWith(<MizitoLettersPage />);
    await screen.findAllByTestId('letters-row');
    fireEvent.click(screen.getByTestId('letters-tab-outbox'));
    await waitFor(() => expect(screen.getByTestId('letters-tab-outbox').getAttribute('aria-selected')).toBe('true'));
    await waitFor(() => expect(screen.getAllByTestId('letters-row')).toHaveLength(1));
    const calls = apiGetMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((p) => p.includes('box=outbox'))).toBe(true);
  });

  it('shows empty state when the box is empty', async () => {
    renderWith(<MizitoLettersPage />);
    await screen.findAllByTestId('letters-row');
    fireEvent.click(screen.getByTestId('letters-tab-archived'));
    expect(await screen.findByTestId('letters-empty')).toBeTruthy();
  });
});

describe('MizitoComposeLetterModal', () => {
  it('keeps send disabled until subject, recipient and body are filled', async () => {
    renderWith(<MizitoComposeLetterModal onClose={() => {}} />);
    const send = screen.getByTestId('letters-compose-submit') as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('موضوع'), { target: { value: 'موضوع تست' } });
    expect(send.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('جستجوی گیرنده'), { target: { value: 'ابراهیم' } });
    const option = await screen.findByTestId('letters-recipient-option');
    fireEvent.click(option);
    expect(send.disabled).toBe(true);

    const body = screen.getByTestId('letters-compose-body');
    body.innerHTML = '<p>متن نامه</p>';
    fireEvent.input(body);
    await waitFor(() => expect(send.disabled).toBe(false));
  });

  it('posts the compose contract body on send', async () => {
    apiPostMock.mockResolvedValueOnce({ id: 'NEW' });
    const onClose = vi.fn();
    renderWith(<MizitoComposeLetterModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('موضوع'), { target: { value: 'موضوع تست' } });
    fireEvent.change(screen.getByLabelText('جستجوی گیرنده'), { target: { value: 'ابراهیم' } });
    fireEvent.click(await screen.findByTestId('letters-recipient-option'));
    const body = screen.getByTestId('letters-compose-body');
    body.innerHTML = '<p>متن نامه</p>';
    fireEvent.input(body);
    fireEvent.click(screen.getByTestId('letters-compose-submit'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiPostMock).toHaveBeenCalledWith(
      '/v1/correspondence/compose/',
      expect.objectContaining({ subject: 'موضوع تست', to_user_ids: ['U9'], label_ids: [] }),
    );
  });
});

describe('sanitizeLetterHtml', () => {
  it('strips script and onerror payloads', () => {
    const out = sanitizeLetterHtml('<p>ok</p><script>alert(1)</script><img src=x onerror="alert(2)"><b onclick="x()">b</b>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('<img');
    expect(out).toContain('<p>ok</p>');
    expect(out).toContain('<b>b</b>');
  });

  it('keeps only http, https and mailto links and forces rel/target', () => {
    const ok = sanitizeLetterHtml('<a href="https://example.com/x">x</a>');
    expect(ok).toContain('href="https://example.com/x"');
    expect(ok).toContain('rel="noopener noreferrer"');
    expect(ok).toContain('target="_blank"');
    expect(sanitizeLetterHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    expect(sanitizeLetterHtml('<a href="data:text/html,hi">x</a>')).not.toContain('data:');
    expect(sanitizeLetterHtml('<a href="mailto:a@b.co">m</a>')).toContain('href="mailto:a@b.co"');
  });

  it('drops tags outside the allowlist', () => {
    const out = sanitizeLetterHtml('<h1>t</h1><table><tr><td>c</td></tr></table><blockquote>q</blockquote>');
    expect(out).not.toContain('<h1');
    expect(out).not.toContain('<table');
    expect(out).toContain('<blockquote>q</blockquote>');
  });
});

describe('MizitoLetterDetail', () => {
  it('renders the thread, sanitizes body and marks the letter read', async () => {
    renderWith(<MizitoLetterDetail letterId="L1" onBack={() => {}} />);
    const message = await screen.findByTestId('letter-message');
    expect(within(message).getByText('آرش پیرنیا به من')).toBeTruthy();
    expect(message.querySelector('script')).toBeNull();
    expect(message.textContent).toContain('لطفاً بررسی شود');
    expect(within(message).getByText('nakhshe.pdf')).toBeTruthy();
    expect(screen.getByText('موضوع: درخواست تأیید نقشه')).toBeTruthy();
    expect(screen.getByText('بازگشت به کارتابل')).toBeTruthy();
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith('/v1/correspondence/L1/read/'),
    );
  });
});
