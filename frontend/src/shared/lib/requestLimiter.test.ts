import { describe, expect, it } from 'vitest';
import { createRequestLimiter } from './requestLimiter';

describe('createRequestLimiter', () => {
  it('never runs more than max at once and runs all queued calls', async () => {
    const limit = createRequestLimiter(3);
    let now = 0;
    let peak = 0;
    const task = async (i: number) => {
      now += 1;
      peak = Math.max(peak, now);
      await new Promise((r) => setTimeout(r, 5));
      now -= 1;
      return i;
    };
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => limit(() => task(i))));
    expect(peak).toBe(3);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('rejects the failed call without blocking the queue', async () => {
    const limit = createRequestLimiter(1);
    const bad = limit(() => Promise.reject(new Error('boom')));
    const good = limit(async () => 'ok');
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('ok');
  });
});
