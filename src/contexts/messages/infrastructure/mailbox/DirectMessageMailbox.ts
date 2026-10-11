import { randomBytes } from '@noble/hashes/utils.js';
import { Buffer } from 'buffer';

import type {
  ChatMessage,
  ConversationResource,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { DirectMessageMailboxState } from './DirectMessageMailboxStore';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from './DirectMessageMailboxStore';

export type DirectMessageMailboxDelivery = 'delivered' | 'failed' | 'skipped';

/** What the outgoing message carries beyond text. */
export type DirectMessageOutgoing = {
  attachmentCount: number;
  hasReply: boolean;
  hasSticker: boolean;
};

/**
 * Direct one-to-one text over the opaque mailbox. The legacy send delivers
 * first; this path carries a copy so the peer can receive it without the
 * replicated path. Duplicates collapse by message id in the timeline.
 */
export class DirectMessageMailbox {
  private static readonly PAGE_SIZE = 50;
  private static readonly READ_TOKEN_BYTES = 32;
  private static readonly EPOCH = 0;

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly store: DirectMessageMailboxStore,
    private readonly projection: Pick<MessageProjectionPort, 'decryptMany'>,
  ) {}

  /**
   * Sender. Appends the already-sent record to the peer's inbox. Returns
   * 'skipped' when there is no peer or the message is not eligible, which
   * leaves it on the legacy path only. Never throws: any failure, including
   * 404 for an inbox the peer has not opened yet, returns 'failed'. The caller
   * keeps the legacy copy and shows nothing to the user.
   */
  public async deliver(
    session: Session,
    conversation: ConversationResource,
    sent: MessageResource,
    outgoing: DirectMessageOutgoing,
  ): Promise<DirectMessageMailboxDelivery> {
    const recipientIdentityId = conversation.participantIds.find(
      (identityId) => identityId !== session.identity.id,
    );

    if (
      !recipientIdentityId ||
      !DirectMessageMailboxRecord.isEligible({
        ...outgoing,
        conversationType: conversation.type,
      })
    ) {
      return 'skipped';
    }

    try {
      const keys = this.keysFor(session, conversation.id, recipientIdentityId);
      const record = DirectMessageMailboxRecord.fromSent(conversation.id, sent);

      await this.channel.send(keys, DirectMessageMailboxRecord.encode(record));

      return 'delivered';
    } catch {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox append failed; legacy copy kept.');

      return 'failed';
    }
  }

  /**
   * Recipient. Reads the next page of this identity's inbox, applies decrypted
   * messages, then acknowledges. The cursor advances only after the
   * acknowledgement succeeds, so an interrupted pass is replayed and the
   * timeline dedupes by id. Aborts before apply or before ack leave the inbox
   * untouched.
   */
  public async sync(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (messages: ChatMessage[]) => void,
  ): Promise<void> {
    const keys = this.keysFor(session, conversationId, session.identity.id);
    const state = this.store.load(keys.mailboxId) ?? this.createState(keys);
    const page = await this.channel.read(
      keys,
      state.readToken,
      state.cursor,
      DirectMessageMailbox.PAGE_SIZE,
    );

    if (page.lastCursor <= state.cursor || signal.aborted) return;

    const records = page.envelopes.flatMap((envelope) => {
      const decoded = DirectMessageMailboxRecord.decode(
        envelope.plaintext,
        conversationId,
      );

      return decoded ? [decoded] : [];
    });
    const messages =
      records.length > 0
        ? await this.projection.decryptMany(
            session,
            conversationId,
            records,
            signal,
          )
        : [];

    if (signal.aborted) return;

    apply(messages);

    if (signal.aborted) return;

    await this.channel.acknowledge(keys, state.readToken, page.lastCursor);
    this.store.save(keys.mailboxId, {
      cursor: page.lastCursor,
      readToken: state.readToken,
    });
  }

  private createState(keys: MailboxKeys): DirectMessageMailboxState {
    const state: DirectMessageMailboxState = {
      cursor: 0,
      readToken: encodeBase64Url(
        randomBytes(DirectMessageMailbox.READ_TOKEN_BYTES),
      ),
    };

    this.store.save(keys.mailboxId, state);

    return state;
  }

  private keysFor(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): MailboxKeys {
    const entry = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!entry) throw new Error('Conversation key is required.');

    return MailboxKeySchedule.derive(
      Buffer.from(entry.key, 'base64'),
      recipientIdentityId,
      DirectMessageMailbox.EPOCH,
    );
  }
}
