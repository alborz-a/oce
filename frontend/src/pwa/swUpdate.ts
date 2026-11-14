/**
 * Keep an installed service worker from pinning a visitor to an old release.
 *
 * The generated worker skips waiting and claims its clients, but nothing reloads
 * the page that was already open, and the browser only re-checks ``/sw.js`` on
 * navigation. So a long-lived tab or an installed app kept showing the previous
 * version until the site data was cleared by hand.
 *
 * - ask for a newer worker on load, when the tab becomes visible, and hourly;
 * - when a new worker takes control of a page that already had one, reload once.
 *   The first install (no previous controller) never reloads, and a timestamp
 *   guard caps reloads so a misbehaving worker cannot start a loop.
 */
const RELOAD_KEY = 'oe_sw_reload_at';
const RELOAD_GUARD_MS = 30_000;
const UPDATE_EVERY_MS = 60 * 60 * 1000;

export function initServiceWorkerUpdates(
  nav: Pick<Navigator, 'serviceWorker'> | undefined = typeof navigator === 'undefined' ? undefined : navigator,
  doc: Pick<Document, 'addEventListener' | 'visibilityState'> | undefined = typeof document === 'undefined'
    ? undefined
    : document,
  reload: () => void = () => window.location.reload(),
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = typeof sessionStorage === 'undefined'
    ? undefined
    : sessionStorage,
): void {
  const sw = nav?.serviceWorker;
  if (!sw) return;

  const hadController = !!sw.controller;
  const checkForUpdate = () => {
    void sw
      .getRegistration()
      .then((reg) => reg?.update())
      .catch(() => undefined);
  };

  sw.addEventListener('controllerchange', () => {
    if (!hadController) return;
    let last = 0;
    try {
      last = Number(storage?.getItem(RELOAD_KEY) || 0);
    } catch {
      // Storage blocked: fall through, the controller only changes once per release.
    }
    if (Date.now() - last < RELOAD_GUARD_MS) return;
    try {
      storage?.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    reload();
  });

  checkForUpdate();
  setInterval(checkForUpdate, UPDATE_EVERY_MS);
  doc?.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') checkForUpdate();
  });
}
