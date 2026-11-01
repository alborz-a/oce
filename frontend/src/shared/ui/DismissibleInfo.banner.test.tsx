import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { bannerShownTo } from './infoBanners';

const state = { admin: false, banners: {} as Record<string, { visible: boolean; text: string | null }> };

vi.mock('@/shared/lib/systemAdmin', () => ({ useIsSystemAdmin: () => state.admin }));
vi.mock('./infoBanners', async (orig) => {
  const real = await orig<typeof import('./infoBanners')>();
  return { ...real, useInfoBanners: () => ({ data: state.banners }) };
});

import { DismissibleInfo } from './DismissibleInfo';

function renderCard() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <DismissibleInfo storageKey="tasks" title="Tasks">
        Built-in text
      </DismissibleInfo>
    </QueryClientProvider>,
  );
}

describe('bannerShownTo', () => {
  it('admin always, others only when switched on', () => {
    expect(bannerShownTo(true, undefined)).toBe(true);
    expect(bannerShownTo(false, undefined)).toBe(false);
    expect(bannerShownTo(false, { visible: false, text: 'x' })).toBe(false);
    expect(bannerShownTo(false, { visible: true, text: null })).toBe(true);
  });
});

describe('DismissibleInfo admin-controlled', () => {
  beforeEach(() => {
    state.admin = false;
    state.banners = {};
    localStorage.clear();
  });

  it('hides the banner from staff by default', () => {
    renderCard();
    expect(screen.queryByText('Tasks')).toBeNull();
  });

  it('shows admin text to staff when switched on', () => {
    state.banners = { tasks: { visible: true, text: 'متن مدیر' } };
    renderCard();
    expect(screen.getByText('متن مدیر')).toBeTruthy();
    expect(screen.queryByTestId('banner-admin-controls')).toBeNull();
  });

  it('admin sees the edit controls', () => {
    state.admin = true;
    renderCard();
    expect(screen.getByTestId('banner-admin-controls')).toBeTruthy();
  });
});
