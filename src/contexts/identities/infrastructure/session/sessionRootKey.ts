import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from './Session';

/**
 * The root the mailbox read tokens derive from. A device uses the
 * device-sealed root once it has opened a generation. Until then it falls back
 * to the legacy `masterKey`, which every device of the identity still holds.
 */
export const sessionRootKey = (session: Session): SymmetricKey =>
  session.deviceSealedRootKey ?? session.masterKey;
