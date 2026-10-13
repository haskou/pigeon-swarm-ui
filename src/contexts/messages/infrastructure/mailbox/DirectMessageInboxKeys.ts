import { Buffer } from 'buffer';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MailboxReadTokens } from '../../../mailboxes/infrastructure/MailboxChannel';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { ConversationKeyRequiredError } from '../../domain/errors/ConversationKeyRequiredError';

/** Keys and reader tokens for the inboxes of one direct conversation. */
export class DirectMessageInboxKeys {
  private static readonly EPOCH = 0;

  public static keysFor(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): MailboxKeys {
    const entry = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!entry) throw new ConversationKeyRequiredError();

    return MailboxKeySchedule.derive(
      Buffer.from(entry.key, 'base64'),
      recipientIdentityId,
      DirectMessageInboxKeys.EPOCH,
    );
  }

  /**
   * The root token manages the reader set. The device token reads and acks
   * under this device's credential. Both derive from the session root.
   */
  public static readersFor(
    session: Session,
    keys: MailboxKeys,
  ): MailboxReadTokens {
    const rootKey = sessionRootKey(session).getBuffer();

    return {
      device: MailboxReadToken.deriveDevice(
        rootKey,
        keys.mailboxId,
        session.deviceCredentialKeyPair.toPrimitives().publicKey,
      ),
      root: MailboxReadToken.derive(rootKey, keys.mailboxId),
    };
  }
}
