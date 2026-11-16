import { create } from 'zustand';

/**
 * True while the Mizito project workspace is mounted. AppLayout reads it to swap
 * the OCE sidebar and header for the Mizito global top bar, and the install
 * prompt reads it so it never covers the composer.
 */
interface WorkspaceChromeState {
  active: boolean;
  setActive: (active: boolean) => void;
}

export const useWorkspaceChromeStore = create<WorkspaceChromeState>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));
