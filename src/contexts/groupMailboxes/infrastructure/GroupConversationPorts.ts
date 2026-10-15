import type { Session } from '../../identities/infrastructure/session/Session';
import type { PigeonMailboxClient } from '../../mailboxes/infrastructure/http/PigeonMailboxClient';
import type { MailboxChannel } from '../../mailboxes/infrastructure/MailboxChannel';
import type { MessageProjector } from '../../messages/infrastructure/crypto/MessageProjector';
import type { PigeonMessageCommandsApi } from '../../messages/infrastructure/http/PigeonMessageCommandsApi';
import type { DirectMessageReaderSet } from '../../messages/infrastructure/mailbox/DirectMessageReaderSet';
import type { GroupMailboxDirectLink } from './control/GroupMailboxDirectLink';
import type { GroupMailboxNotificationInbox } from './control/GroupMailboxNotificationInbox';

/** What the group conversation mailbox needs from the rest of the app. */
export type GroupConversationPorts = {
  channel: Pick<
    MailboxChannel,
    'acknowledge' | 'addReader' | 'listReaders' | 'read' | 'send'
  >;
  client: Pick<PigeonMailboxClient, 'delete'>;
  composer: Pick<PigeonMessageCommandsApi, 'composeEdit' | 'withSentRecord'>;
  /**
   * The identities this identity pinned as contacts on this device. Only
   * this device's user pins one, so no welcomer can add one.
   */
  contacts: (session: Session) => readonly string[];
  /** The 1:1 carrier of control letters for one signed-in identity. */
  direct: (session: Session) => GroupMailboxDirectLink;
  /** This identity's notifications, and the state records resolving them. */
  notifications: GroupMailboxNotificationInbox;
  now: () => number;
  projector: Pick<MessageProjector, 'projectPlaintext'>;
  /** Enrols, bridges and prunes the readers of this identity's inboxes. */
  readerSet: Pick<
    DirectMessageReaderSet,
    'cutOff' | 'enrolSealedRoot' | 'reconcile'
  >;
  /** Prefix of every local database the group mailbox writes. */
  storage: string;
  /**
   * Credentials this identity's signed transitions authorize at their head,
   * never the node's device list; rejects when unproven or removed.
   */
  verifiedDevices: (session: Session) => Promise<readonly string[]>;
};
