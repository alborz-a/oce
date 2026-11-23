/**
 * Caps how many async requests run at once. Extra calls wait in FIFO order and start as slots free up.
 * Used so a screen with many presigned image URLs does not open 100+ requests at the same time.
 */
export function createRequestLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const drain = () => {
    while (active < max && queue.length > 0) {
      const start = queue.shift();
      start?.();
    }
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        active += 1;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            drain();
          });
      });
      drain();
    });
  };
}

/** Shared limiter for presigned image URL requests (max 6 in flight). */
export const presignRequestLimit = createRequestLimiter(6);
