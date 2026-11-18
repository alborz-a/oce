import { useCallback, useState } from 'react';

/** localStorage key: '1' when the desktop switcher column is hidden by the user. */
export const SWITCHER_HIDDEN_KEY = 'mz-switcher-hidden';
const DESKTOP_QUERY = '(min-width:1024px)';

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(SWITCHER_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(SWITCHER_HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    /* storage unavailable (private mode): keep in-memory state only */
  }
}

function isDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/**
 * Switcher state for Mizito workspace hosts.
 * - `open` / `setOpen` / `toggle`: mobile and tablet (<1024px) drawer.
 * - `desktopHidden` / `toggleDesktop`: desktop (>=1024px) switcher column, persisted in localStorage.
 * - `onMenuClick`: the منو button. Desktop toggles the column, otherwise the drawer.
 */
export function useSwitcherState() {
  const [open, setOpen] = useState(false);
  const [desktopHidden, setDesktopHidden] = useState<boolean>(readHidden);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const toggleDesktop = useCallback(() => {
    setDesktopHidden((hidden) => {
      const next = !hidden;
      writeHidden(next);
      return next;
    });
  }, []);

  const onMenuClick = useCallback(() => {
    if (isDesktop()) toggleDesktop();
    else toggle();
  }, [toggle, toggleDesktop]);

  return { open, setOpen, toggle, desktopHidden, toggleDesktop, onMenuClick };
}
