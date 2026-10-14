import type { Timestamp } from '@haskou/value-objects';

import type { PresenceSharing } from './PresenceSharing';
import type { IdentityPresenceStatus } from './value-objects/IdentityPresenceStatus';

/** The last status the broadcast sent through one sharing, and when. */
export type SentContactPresence = {
  at: Timestamp;
  sharing: PresenceSharing;
  status: IdentityPresenceStatus | null;
};
