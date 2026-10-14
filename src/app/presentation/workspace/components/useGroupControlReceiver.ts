import { useEffect } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../composition/applicationContainer';

/**
 * Reads the identity's group control letters (key package requests and
 * welcomes into new groups) while the workspace is open: once at start, then
 * fifteen seconds after each run settles. `receiveControl` never throws.
 */
export function useGroupControlReceiver(session: Session): void {
  useEffect(() => {
    const receiveIntervalMs = 15_000;
    let stopped = false;
    let timer: number | undefined;
    const run = async (): Promise<void> => {
      await applicationContainer.groupMessages.receiveControl(session);

      if (stopped) return;
      timer = window.setTimeout(() => void run(), receiveIntervalMs);
    };

    void run();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [session]);
}
