import type { Timestamp } from '@haskou/value-objects';

import type { ContactPresence } from './ContactPresence';

/** A contact's update as the board holds it, with when it arrived. */
export type HeldContactPresence = {
  presence: ContactPresence;
  receivedAt: Timestamp;
};
