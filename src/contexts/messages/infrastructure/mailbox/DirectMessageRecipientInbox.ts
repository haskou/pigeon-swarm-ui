import type { MailboxInboxKeys } from '@haskou/pigeon-swarm-crypto';

import type { MailboxReadTokens } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { DirectMessageInboxOutcome } from './DirectMessageInboxOutcome';
import type { DirectMessageMailboxState } from './DirectMessageMailboxStore';

/** Keys, reader tokens, and saved state for the inbox this device reads. */
export type DirectMessageRecipientInbox = {
  keys: MailboxInboxKeys;
  readers: MailboxReadTokens;
  outcome: DirectMessageInboxOutcome;
  state: DirectMessageMailboxState;
};
