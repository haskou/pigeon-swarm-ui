import { useEffect } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { logCallWarning } from '../../../../contexts/calls/infrastructure/media/callDebugLogger';

const REPUBLISH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keeps this device's sealing record for the current UTC day published, on
 * session start and periodically so the day rollover is covered.
 */
export function useDeviceSealingRecords(
  identityId: string,
  publish: () => Promise<void>,
  currentSession: () => Session,
): void {
  useEffect(() => {
    const run = () => {
      void publish().catch(() =>
        logCallWarning('Sealing record publication failed', {
          identityId: currentSession().identity.id,
        }),
      );
    };

    run();
    const timer = setInterval(run, REPUBLISH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [identityId]);
}
