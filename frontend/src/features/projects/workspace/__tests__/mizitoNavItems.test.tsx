import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MizitoNav } from '../components/MizitoNav';
import { useProjectContextStore } from '@/stores/useProjectContextStore';

describe('MizitoNav drawer items', () => {
  it('renders 10 items in order with expected hrefs and material icon names', () => {
    useProjectContextStore.getState().clearProject();
    render(
      <MemoryRouter>
        <MizitoNav />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(10);

    const expected = [
      { label: 'داشبورد', href: '/', icon: 'home' },
      { label: 'گفتگو', href: '/colleagues', icon: 'chat' },
      { label: 'پروژه‌ها', href: '/projects', icon: 'library_books' },
      { label: 'وظایف', href: '/tasks', icon: 'offline_pin' },
      { label: 'نامه‌ها', href: '/correspondence', icon: 'inbox' },
      { label: 'یادداشت\u200cهای من', href: '/notes', icon: 'assignment' },
      { label: 'همکارانم', href: '/colleagues', icon: 'people' },
      { label: 'میزکار جدید', href: '/mizito/', icon: 'dashboard' },
      { label: 'پرونده مشتریان', href: '/customers', icon: 'perm_contact_calendar' },
      { label: 'مانیتورینگ', href: '/monitoring', icon: 'assessment' },
    ];

    expected.forEach((item, index) => {
      const link = links[index];
      expect(link).toHaveAttribute('href', item.href);
      expect(link).toHaveTextContent(item.label);
      expect(link?.querySelector('.mz-icon')?.textContent).toBe(item.icon);
    });
  });
});
