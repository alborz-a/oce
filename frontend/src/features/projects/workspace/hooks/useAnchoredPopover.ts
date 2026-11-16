import { useCallback, useEffect, useLayoutEffect, type RefObject } from 'react';

const GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;

type ToggleLikeEvent = Event & { newState?: string };

/**
 * Anchors a popover (native `popover` attribute, or a fallback panel that is
 * shown through state) directly under its trigger button.
 *
 * - Native popovers are re-placed on `beforetoggle` / `toggle` when they open,
 *   because the top layer otherwise ignores the trigger position.
 * - `fallbackOpen` covers browsers without the Popover API (state-controlled panel).
 * - Placement is `position: fixed` with the popover's inline-end edge (left in RTL)
 *   aligned to the trigger's inline-end edge, clamped inside the viewport with an
 *   8px margin.
 */
export function useAnchoredPopover(
  triggerRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  fallbackOpen = false,
): void {
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const pop = popoverRef.current;
    if (!trigger || !pop) return;
    const rect = trigger.getBoundingClientRect();
    const popWidth = pop.getBoundingClientRect().width || pop.offsetWidth;
    const maxLeft = window.innerWidth - popWidth - VIEWPORT_MARGIN_PX;
    const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(rect.left, maxLeft));
    pop.style.position = 'fixed';
    pop.style.inset = 'auto';
    pop.style.margin = '0';
    pop.style.top = `${rect.bottom + GAP_PX}px`;
    pop.style.left = `${left}px`;
    pop.style.right = 'auto';
  }, [triggerRef, popoverRef]);

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
