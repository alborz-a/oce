/**
 * True when a tap should open an item at once instead of only selecting it.
 * Touch has no double-click, so a coarse pointer (or a click that began as a
 * touch/pen press, for phones whose media query reports a fine pointer) opens.
 */
let lastPointerType = 'mouse';

export function notePointerType(e: { pointerType?: string }): void {
  lastPointerType = e.pointerType || 'mouse';
}

export function isTouchTap(): boolean {
  if (lastPointerType === 'touch' || lastPointerType === 'pen') return true;
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}
