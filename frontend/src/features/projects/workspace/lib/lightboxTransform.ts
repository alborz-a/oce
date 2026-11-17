// Pure zoom/rotate state helpers for the chat photo lightbox (CSS transform only, no network).

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

/** Clamps a zoom factor into [ZOOM_MIN, ZOOM_MAX]. Non-finite input resets to 1. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** Steps zoom by ZOOM_STEP (+1 zoom in, -1 zoom out) and clamps the result. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(Math.round((zoom + direction * ZOOM_STEP) * 100) / 100);
}

/** Normalises rotation to 0, 90, 180 or 270 degrees. Step is a multiple of 90 (e.g. -90 or 90). */
export function rotateBy(degrees: number, step: number): number {
  const next = degrees + step;
  return ((next % 360) + 360) % 360;
}
