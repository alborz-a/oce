import { useCallback, useEffect, useLayoutEffect, type RefObject } from 'react';
import { computeFloatingPosition, type FloatingSide } from '@/shared/ui/floatingPosition';

const GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;
const FALLBACK_POPUP_HEIGHT_PX = 320;

type ToggleLikeEvent = Event & { newState?: string };

/**
 * Anchors a popover (native `popover` attribute, or a fallback panel that is
 * shown through state) directly under its trigger button.
 *
 * - Native popovers are re-placed on `beforetoggle` / `toggle` when they open,
 *   because the top layer otherwise ignores the trigger position.
 * - `fallbackOpen` covers browsers without the Popover API (state-controlled panel).
 * - Placement is `position: fixed`, on the `preferred` side of the trigger (flips to the
 *   other side when there is no room), left edge aligned to the trigger, clamped inside
 *   the viewport with an 8px margin. Placement logic: `shared/ui/floatingPosition`.
 */
export function useAnchoredPopover(
  triggerRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  fallbackOpen = false,
  preferred: FloatingSide = 'bottom',
): void {
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const pop = popoverRef.current;
    if (!trigger || !pop) return;
    const rect = trigger.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    // Native popovers are display:none until open, so height is 0 on beforetoggle;
    // the toggle event re-places with the real size.
    const { top, left } = computeFloatingPosition({
      trigger: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
      popup: {
        width: popRect.width || pop.offsetWidth,
        height: popRect.height || pop.offsetHeight || FALLBACK_POPUP_HEIGHT_PX,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      preferred,
      gap: GAP_PX,
      margin: VIEWPORT_MARGIN_PX,
    });
    pop.style.position = 'fixed';
    pop.style.inset = 'auto';
    pop.style.margin = '0';
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.style.right = 'auto';
  }, [triggerRef, popoverRef, preferred]);

  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;
    const onOpening = (event: Event) => {
      if ((event as ToggleLikeEvent).newState === 'open') place();
    };
    pop.addEventListener('beforetoggle', onOpening);
    pop.addEventListener('toggle', onOpening);
    window.addEventListener('resize', place);
    return () => {
      pop.removeEventListener('beforetoggle', onOpening);
      pop.removeEventListener('toggle', onOpening);
      window.removeEventListener('resize', place);
    };
  }, [place, popoverRef]);

  useLayoutEffect(() => {
    if (fallbackOpen) place();
  }, [fallbackOpen, place]);
}
