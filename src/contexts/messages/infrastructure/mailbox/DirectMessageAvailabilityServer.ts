import type { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { DirectMessageMailboxStore } from './DirectMessageMailboxStore';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';

/** One availability server this device picked to hold a copy of its inbox. */
export interface DirectMessageAvailabilityServer {
  base: string;
  channel: MailboxChannel;
  readerSet: DirectMessageReaderSet;
  /** Read capability and cursor on this server, namespaced by its base. */
  store: DirectMessageMailboxStore;
}
