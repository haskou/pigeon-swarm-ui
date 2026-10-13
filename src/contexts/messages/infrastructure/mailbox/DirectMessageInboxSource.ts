import type { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { DirectMessageInboxOpener } from './DirectMessageInboxOpener';
import type { DirectMessageMailboxStore } from './DirectMessageMailboxStore';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';

/** One node holding this device's inbox: the connected one or an extra. */
export interface DirectMessageInboxSource {
  channel: MailboxChannel;
  opener: DirectMessageInboxOpener;
  readerSet: DirectMessageReaderSet;
  store: DirectMessageMailboxStore;
}
