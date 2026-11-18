import { useEffect } from 'react';
import { CorrespondencePage } from '@/features/correspondence/CorrespondencePage';
import { useWorkspaceChromeStore } from '@/stores/useWorkspaceChromeStore';

/**
 * «نامه‌ها» inside the Mizito shell. Sets the workspace chrome active while mounted, so AppLayout
 * shows the Mizito global top bar instead of the OCE header, then renders the existing
 * correspondence module unchanged (no new module, no new data).
 */
export function MizitoCorrespondencePage() {
  const setChromeActive = useWorkspaceChromeStore((st) => st.setActive);
  useEffect(() => {
    setChromeActive(true);
    return () => setChromeActive(false);
  }, [setChromeActive]);
  return <CorrespondencePage />;
}
