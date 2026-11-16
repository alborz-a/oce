import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_STREAM_FILTERS } from '../types';
import { MizitoTopTabAndFilterBar } from '../components/MizitoTopTabAndFilterBar';

describe('project tab nav at mobile width', () => {
  it('renders the tab nav without the hidden class and scrollable on overflow', () => {
    render(
      <MizitoTopTabAndFilterBar
        activeTab="group"
        onTabChange={vi.fn()}
        filters={DEFAULT_STREAM_FILTERS}
        onFiltersChange={vi.fn()}
        canSwitchToEngineering={false}
      />,
    );
    const nav = screen.getByRole('tablist', { name: 'بخش‌های فضای کار پروژه' });
    expect(nav).not.toHaveClass('hidden');
    expect(nav).toHaveClass('overflow-x-auto');
    expect(screen.getByTestId('workspace-tab-group')).toBeInTheDocument();
  });
});
