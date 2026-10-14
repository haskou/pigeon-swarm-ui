import { useCallback, useEffect } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../composition/applicationContainer';

/**
 * Reads the identity's group control letters (key package requests and
 * welcomes into new groups) while the workspace is open: once at start, then
 * fifteen seconds after each run settles, and at once through the returned
 * callback. A run whose welcome joined a group refreshes the conversation
 * list, so the new group shows. `receiveControl` never throws.
 */
export function useGroupControlReceiver(
  session: Session,
  refreshConversations: () => Promise<unknown>,
): () => void {
  const receive = useCallback(async (): Promise<void> => {
    const joined =
      await applicationContainer.groupMessages.receiveControl(session);

    if (joined.length > 0) await refreshConversations().catch(() => null);
  }, [refreshConversations, session]);

  useEffect(() => {
    const receiveIntervalMs = 15_000;
    let stopped = false;
    let timer: number | undefined;
    const run = async (): Promise<void> => {
      await receive();

      if (stopped) return;
      timer = window.setTimeout(() => void run(), receiveIntervalMs);
    };

    void run();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [receive]);

  return useCallback(() => void receive(), [receive]);
}
