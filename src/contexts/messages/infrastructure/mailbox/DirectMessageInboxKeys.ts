import type { MailboxInboxKeys } from '@haskou/pigeon-swarm-crypto';

import {
  MailboxKeySchedule,
  MailboxReadToken,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { MailboxReadTokens } from '../../../mailboxes/infrastructure/MailboxChannel';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { ConversationKeyRequiredError } from '../../domain/errors/ConversationKeyRequiredError';

/** Keys and reader tokens for the inboxes of one direct conversation. */
export class DirectMessageInboxKeys {
  private static readonly EPOCH = 0;

  public static keysFor(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): MailboxInboxKeys {
    const entry = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!entry) throw new ConversationKeyRequiredError();

    return MailboxKeySchedule.derive(
      SymmetricKey.fromBase64(entry.key),
      recipientIdentityId,
      DirectMessageInboxKeys.EPOCH,
    );
  }

  /**
   * The root token manages the reader set. The device token reads and acks
   * under a device's credential, this device's unless another is named. Both
   * derive from the session root.
   */
  public static readersFor(
    session: Session,
    keys: MailboxInboxKeys,
    credential: string = session.deviceCredentialKeyPair.toPrimitives()
      .publicKey,
  ): MailboxReadTokens {
    const rootKey = sessionRootKey(session);

    return {
      device: MailboxReadToken.deriveDevice(
        rootKey,
        keys.mailboxId,
        credential,
      ),
      root: MailboxReadToken.derive(rootKey, keys.mailboxId),
    };
  }
}
