import { describe, expect, it } from 'vitest';
import { computeFloatingPosition, type FloatingTriggerRect } from './floatingPosition';

function rect(top: number, left: number, width = 28, height = 28): FloatingTriggerRect {
  return { top, left, bottom: top + height, right: left + width, width, height };
}

const viewport = { width: 1000, height: 800 };
const popup = { width: 240, height: 200 };

describe('computeFloatingPosition', () => {
  it('places below the trigger when the preferred side is bottom and there is room', () => {
    const r = computeFloatingPosition({ trigger: rect(100, 300), popup, viewport, preferred: 'bottom' });
    expect(r.placement).toBe('bottom');
    expect(r.top).toBe(100 + 28 + 4);
    expect(r.left).toBe(300);
  });

  it('places above the trigger when the preferred side is top and there is room', () => {
    const r = computeFloatingPosition({ trigger: rect(600, 300), popup, viewport, preferred: 'top' });
    expect(r.placement).toBe('top');
    expect(r.top).toBe(600 - 4 - 200);
  });

  it('flips a top preference to below when there is no room above (mention button near page top)', () => {
    const r = computeFloatingPosition({ trigger: rect(40, 300), popup, viewport, preferred: 'top' });
    expect(r.placement).toBe('bottom');
    expect(r.top).toBe(40 + 28 + 4);
  });

  it('flips a bottom preference to above when there is no room below (composer at page bottom)', () => {
    const r = computeFloatingPosition({ trigger: rect(740, 300), popup, viewport, preferred: 'bottom' });
    expect(r.placement).toBe('top');
    expect(r.top).toBe(740 - 4 - 200);
  });

  it('clamps the left edge inside the viewport with the margin', () => {
    const tooFarRight = computeFloatingPosition({ trigger: rect(100, 990), popup, viewport });
    expect(tooFarRight.left).toBe(1000 - 240 - 8);
    const tooFarLeft = computeFloatingPosition({ trigger: rect(100, -50), popup, viewport });
    expect(tooFarLeft.left).toBe(8);
  });

  it('keeps the top inside the viewport when neither side fits fully', () => {
    const tall = { width: 240, height: 900 };
    const r = computeFloatingPosition({ trigger: rect(400, 300), popup: tall, viewport, preferred: 'bottom' });
    expect(r.top).toBeGreaterThanOrEqual(8);
  });
});
