import type { MailboxInboxKeys } from '@haskou/pigeon-swarm-crypto';

import {
  MailboxKeySchedule,
  MailboxReadToken,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../session/Session';

import { ConversationKeychain } from '../keychain/ConversationKeychain';
import { sessionRootKey } from '../session/sessionRootKey';

/**
 * Keys of the presence inbox each side of a direct conversation reads. The
 * library separates them from the message inboxes, so the presence inboxes
 * share no identifier or key with them.
 */
export class ContactPresenceInboxKeys {
  /** The inbox of `recipientIdentityId`; null without the conversation key. */
  public static keysFor(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): MailboxInboxKeys | null {
    const entry = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!entry) return null;

    return MailboxKeySchedule.contactPresence(
      SymmetricKey.fromBase64(entry.key),
      recipientIdentityId,
    );
  }

  /**
   * The only reader of the inbox, shared by the identity's devices: the
   * session's sealed root, which a revoke rotates.
   */
  public static readerFor(session: Session, keys: MailboxInboxKeys): string {
    return MailboxReadToken.derive(sessionRootKey(session), keys.mailboxId);
  }
}
