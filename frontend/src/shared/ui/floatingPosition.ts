import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export type FloatingSide = 'top' | 'bottom';

export interface FloatingTriggerRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export interface FloatingPositionInput {
  trigger: FloatingTriggerRect;
  popup: { width: number; height: number };
  viewport: { width: number; height: number };
  /** Side to try first. Falls back to the other side when there is no room. */
  preferred?: FloatingSide;
  /** Space between trigger and popup, px. */
  gap?: number;
  /** Minimum distance kept from every viewport edge, px. */
  margin?: number;
}

export interface FloatingPositionResult {
  top: number;
  left: number;
  placement: FloatingSide;
}

export const FLOATING_GAP_PX = 4;
export const FLOATING_MARGIN_PX = 8;
export const FLOATING_Z_INDEX = 1100;

function clamp(value: number, min: number, max: number): number {
  // When the popup is larger than the viewport the lower bound wins.
  return Math.max(min, Math.min(value, max));
}

/**
 * Pure placement: picks top or bottom of the trigger (preferred side first, flip
 * when the preferred side has no room), then clamps the popup inside the viewport.
 * `left` aligns the popup's left edge with the trigger's left edge.
 */
export function computeFloatingPosition(input: FloatingPositionInput): FloatingPositionResult {
  const gap = input.gap ?? FLOATING_GAP_PX;
  const margin = input.margin ?? FLOATING_MARGIN_PX;
  const preferred = input.preferred ?? 'bottom';
  const { trigger, popup, viewport } = input;

  const spaceBelow = viewport.height - trigger.bottom - gap;
  const spaceAbove = trigger.top - gap;
  const needed = popup.height + margin;
  const fits = (side: FloatingSide) => (side === 'bottom' ? spaceBelow : spaceAbove) >= needed;

  let placement: FloatingSide;
  if (fits(preferred)) {
    placement = preferred;
  } else if (fits(preferred === 'bottom' ? 'top' : 'bottom')) {
    placement = preferred === 'bottom' ? 'top' : 'bottom';
  } else {
    // Neither side fits fully: use the roomier one.
    placement = spaceAbove > spaceBelow ? 'top' : 'bottom';
  }

  const rawTop = placement === 'bottom' ? trigger.bottom + gap : trigger.top - gap - popup.height;
  const top = clamp(rawTop, margin, viewport.height - popup.height - margin);
  const left = clamp(trigger.left, margin, viewport.width - popup.width - margin);

  return { top, left, placement };
}

function rectOf(el: HTMLElement): FloatingTriggerRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
}

/**
 * Fixed-position placement for a React popup (rendered through a portal).
 * Returns `null` while closed or before the first measurement. Recomputes on
 * open, window resize and any scroll (capture, so nested scroll containers count).
 */
export function useFloatingPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  popupRef: RefObject<HTMLElement | null>,
  preferred: FloatingSide = 'bottom',
): CSSProperties | null {
  const [pos, setPos] = useState<FloatingPositionResult | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      const popup = popupRef.current;
      if (!trigger || !popup) return;
      const p = popup.getBoundingClientRect();
      const next = computeFloatingPosition({
        trigger: rectOf(trigger),
        popup: { width: p.width || popup.offsetWidth, height: p.height || popup.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        preferred,
      });
      setPos(next);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, preferred, triggerRef, popupRef]);

  if (!pos) return null;
  return {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    right: 'auto',
    bottom: 'auto',
    margin: 0,
    zIndex: FLOATING_Z_INDEX,
  };
}
