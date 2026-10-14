import type { Session } from '../../identities/infrastructure/session/Session';
import type { PigeonMailboxClient } from '../../mailboxes/infrastructure/http/PigeonMailboxClient';
import type { MailboxChannel } from '../../mailboxes/infrastructure/MailboxChannel';
import type { MessageProjector } from '../../messages/infrastructure/crypto/MessageProjector';
import type { PigeonMessageCommandsApi } from '../../messages/infrastructure/http/PigeonMessageCommandsApi';
import type { GroupMailboxDirectLink } from './control/GroupMailboxDirectLink';
import type { GroupMailboxNotificationPages } from './control/GroupMailboxNotificationPages';

/** What the group conversation mailbox needs from the rest of the app. */
export type GroupConversationPorts = {
  channel: Pick<MailboxChannel, 'acknowledge' | 'read' | 'send'>;
  client: Pick<PigeonMailboxClient, 'delete'>;
  composer: Pick<PigeonMessageCommandsApi, 'composeEdit' | 'withSentRecord'>;
  /** The 1:1 carrier of control letters for one signed-in identity. */
  direct: (session: Session) => GroupMailboxDirectLink;
  notifications: GroupMailboxNotificationPages;
  now: () => number;
  projector: Pick<MessageProjector, 'projectPlaintext'>;
  /** The node's roster of a conversation, as `session` sees it. */
  roster: (
    session: Session,
    conversationId: string,
  ) => Promise<ReadonlySet<string>>;
  /** Prefix of every local database the group mailbox writes. */
  storage: string;
};
