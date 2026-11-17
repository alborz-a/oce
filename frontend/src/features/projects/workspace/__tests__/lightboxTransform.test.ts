import { describe, expect, it } from 'vitest';
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  rotateBy,
  stepZoom,
} from '../lib/lightboxTransform';

describe('lightboxTransform', () => {
  it('clampZoom keeps zoom inside min/max and resets non-finite values', () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it('stepZoom moves by 0.25 and never leaves the clamp range', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });

  it('rotateBy wraps rotation into 0..359 for both directions', () => {
    expect(rotateBy(0, 90)).toBe(90);
    expect(rotateBy(0, -90)).toBe(270);
    expect(rotateBy(270, 90)).toBe(0);
    expect(rotateBy(90, 360)).toBe(90);
  });
});
