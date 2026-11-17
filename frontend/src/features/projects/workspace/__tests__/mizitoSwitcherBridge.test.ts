import { describe, expect, it, vi } from 'vitest';
import { registerMizitoSwitcher, toggleMizitoSwitcher } from '../mizitoSwitcherBridge';

describe('mizitoSwitcherBridge', () => {
  it('returns false when no Mizito workspace is registered', () => {
    expect(toggleMizitoSwitcher()).toBe(false);
  });

  it('calls the registered toggle and returns true', () => {
    const toggle = vi.fn();
    const unregister = registerMizitoSwitcher(toggle);
    expect(toggleMizitoSwitcher()).toBe(true);
    expect(toggle).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('falls back to false after unregister', () => {
    const toggle = vi.fn();
    const unregister = registerMizitoSwitcher(toggle);
    unregister();
    expect(toggleMizitoSwitcher()).toBe(false);
    expect(toggle).not.toHaveBeenCalled();
  });
});
