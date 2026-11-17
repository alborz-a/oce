import { createContext, useContext } from 'react';
import { useOpenColleagueDm } from '../hooks/useOpenColleagueDm';

export interface WorkspaceDmValue {
  /** Opens (or creates) the 1:1 DM with a colleague inside the workspace shell. */
  openDm: (otherUserId: string) => Promise<void>;
}

/** Provided by MizitoProjectWorkspace. Absent in the legacy project view. */
export const WorkspaceDmContext = createContext<WorkspaceDmValue | null>(null);

/** Workspace DM API for any workspace component (e.g. a future mobile drawer). */
export function useWorkspaceDm(): WorkspaceDmValue | null {
  return useContext(WorkspaceDmContext);
}

/**
 * Colleague click handler: inside the workspace it opens the DM in-shell;
 * outside it falls back to the legacy `/chat/:roomId` navigation.
 */
export function useOpenDmForColleague(currentUserId: string | null | undefined) {
  const workspaceDm = useWorkspaceDm();
  const legacyOpenDm = useOpenColleagueDm(currentUserId);
  return workspaceDm ? workspaceDm.openDm : legacyOpenDm;
}
