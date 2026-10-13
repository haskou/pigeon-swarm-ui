import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from './Session';

/**
 * The device-sealed root that mailbox read tokens and drafts derive from.
 * Unlock refuses a session that cannot open it, so a missing root is a fault.
 */
export const sessionRootKey = (session: Session): SymmetricKey => {
  if (!session.deviceSealedRootKey) {
    throw new Error('Device sealed root is not open.');
  }

  return session.deviceSealedRootKey;
};
