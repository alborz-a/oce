type SwitcherToggle = () => void;

let activeToggle: SwitcherToggle | null = null;

/** Mizito workspace registers its switcher drawer toggle while mounted. Returns an unregister fn. */
export function registerMizitoSwitcher(toggle: SwitcherToggle): () => void {
  activeToggle = toggle;
  return () => {
    if (activeToggle === toggle) activeToggle = null;
  };
}

/** Toggles the Mizito switcher drawer. Returns false when no Mizito workspace is mounted. */
export function toggleMizitoSwitcher(): boolean {
  if (!activeToggle) return false;
  activeToggle();
  return true;
}
