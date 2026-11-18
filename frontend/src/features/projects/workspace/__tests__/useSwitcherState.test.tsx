import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useSwitcherState, SWITCHER_HIDDEN_KEY } from '../hooks/useSwitcherState';

function Harness() {
  const { open, desktopHidden, onMenuClick } = useSwitcherState();
  return (
    <div data-testid="root" data-switcher-hidden={desktopHidden ? 'true' : undefined} data-open={open ? 'true' : 'false'}>
      <button type="button" onClick={onMenuClick}>منو</button>
    </div>
  );
}

function mockDesktop(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('useSwitcherState menu toggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('at desktop width the menu click flips data-switcher-hidden and persists it', () => {
    mockDesktop(true);
    render(<Harness />);
    const root = screen.getByTestId('root');
    expect(root).not.toHaveAttribute('data-switcher-hidden');

    fireEvent.click(screen.getByRole('button', { name: 'منو' }));
    expect(root).toHaveAttribute('data-switcher-hidden', 'true');
    expect(root).toHaveAttribute('data-open', 'false');
    expect(window.localStorage.getItem(SWITCHER_HIDDEN_KEY)).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'منو' }));
    expect(root).not.toHaveAttribute('data-switcher-hidden');
    expect(window.localStorage.getItem(SWITCHER_HIDDEN_KEY)).toBe('0');
  });

  it('restores hidden state from localStorage on mount', () => {
    mockDesktop(true);
    window.localStorage.setItem(SWITCHER_HIDDEN_KEY, '1');
    render(<Harness />);
    expect(screen.getByTestId('root')).toHaveAttribute('data-switcher-hidden', 'true');
  });

  it('below 1024px the menu click toggles the drawer, not the desktop column', () => {
    mockDesktop(false);
    render(<Harness />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'منو' }));
    });
    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-open', 'true');
    expect(root).not.toHaveAttribute('data-switcher-hidden');
  });
});
