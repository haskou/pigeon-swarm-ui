import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { Buffer } from 'buffer';

import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { Session } from '../session/Session';

import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { ConversationKeychain } from '../keychain/ConversationKeychain';
import { sessionRootKey } from '../session/sessionRootKey';

/**
 * Keys of the presence inbox each side of a direct conversation reads. The
 * secret is expanded from the conversation key under its own label, so the
 * presence inboxes share no identifier or key with the message inboxes.
 */
export class ContactPresenceInboxKeys {
  private static readonly EPOCH = 0;
  private static readonly LABEL = 'pigeon/contact-presence/v1';

  /** The inbox of `recipientIdentityId`; null without the conversation key. */
  public static keysFor(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): MailboxKeys | null {
    const entry = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!entry) return null;

    return MailboxKeySchedule.derive(
      hkdf(
        sha256,
        Buffer.from(entry.key, 'base64'),
        undefined,
        new TextEncoder().encode(ContactPresenceInboxKeys.LABEL),
        MailboxKeySchedule.SECRET_BYTES,
      ),
      recipientIdentityId,
      ContactPresenceInboxKeys.EPOCH,
    );
  }

  /**
   * The only reader of the inbox, shared by the identity's devices: the
   * session's sealed root, which a revoke rotates.
   */
  public static readerFor(session: Session, keys: MailboxKeys): string {
    return MailboxReadToken.derive(
      sessionRootKey(session).getBuffer(),
      keys.mailboxId,
    );
  }
}
