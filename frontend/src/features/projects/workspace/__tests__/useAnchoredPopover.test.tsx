import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';

function makeTrigger(rect: { left: number; bottom: number }): HTMLButtonElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () =>
    ({ left: rect.left, bottom: rect.bottom, right: rect.left + 28, top: rect.bottom - 28, width: 28, height: 28 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function makePopover(width: number): HTMLDivElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 120, right: width, bottom: 120 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe('useAnchoredPopover', () => {
  it('places the popover under the trigger when the fallback panel is open', () => {
    const trigger = makeTrigger({ left: 100, bottom: 50 });
    const pop = makePopover(200);
    renderHook(() =>
      useAnchoredPopover({ current: trigger }, { current: pop }, true),
    );
    expect(pop.style.position).toBe('fixed');
    expect(pop.style.top).toBe('54px');
    expect(pop.style.left).toBe('100px');
  });

  it('clamps the popover inside the viewport with an 8px margin', () => {
    const trigger = makeTrigger({ left: 2000, bottom: 50 });
    const pop = makePopover(200);
    renderHook(() =>
      useAnchoredPopover({ current: trigger }, { current: pop }, true),
    );
    expect(pop.style.left).toBe(`${window.innerWidth - 200 - 8}px`);
  });

  it('re-places a native popover on beforetoggle with newState open', () => {
    const trigger = makeTrigger({ left: 100, bottom: 50 });
    const pop = makePopover(200);
    renderHook(() =>
      useAnchoredPopover({ current: trigger }, { current: pop }, false),
    );
    // Trigger moved before the popover opened.
    trigger.getBoundingClientRect = () =>
      ({ left: 300, bottom: 90, right: 328, top: 62, width: 28, height: 28 }) as DOMRect;
    pop.dispatchEvent(Object.assign(new Event('beforetoggle'), { newState: 'open' }));
    expect(pop.style.top).toBe('94px');
    expect(pop.style.left).toBe('300px');
  });
});
