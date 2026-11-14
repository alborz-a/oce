import { describe, it, expect, vi } from 'vitest';
import { initServiceWorkerUpdates } from './swUpdate';

function fakeNav(controller: unknown) {
  const handlers: Record<string, () => void> = {};
  const update = vi.fn().mockResolvedValue(undefined);
  return {
    handlers,
    update,
    nav: {
      serviceWorker: {
        controller,
        addEventListener: (n: string, h: () => void) => {
          handlers[n] = h;
        },
        getRegistration: () => Promise.resolve({ update }),
      },
    } as unknown as Navigator,
  };
}

const doc = { addEventListener: vi.fn(), visibilityState: 'visible' } as unknown as Document;
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('initServiceWorkerUpdates', () => {
  it('reloads once when a new worker takes over a controlled page', async () => {
    const { nav, handlers, update } = fakeNav({});
    const reload = vi.fn();
    initServiceWorkerUpdates(nav, doc, reload, mem());
    await Promise.resolve();
    expect(update).toHaveBeenCalled();
    handlers.controllerchange!();
    handlers.controllerchange!();
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('does not reload on the first install', () => {
    const { nav, handlers } = fakeNav(null);
    const reload = vi.fn();
    initServiceWorkerUpdates(nav, doc, reload, mem());
    handlers.controllerchange!();
    expect(reload).not.toHaveBeenCalled();
  });
});
