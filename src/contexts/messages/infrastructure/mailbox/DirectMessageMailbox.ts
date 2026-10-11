import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { DirectMessageMailboxState } from './DirectMessageMailboxStore';

import { Buffer } from 'buffer';
import { randomBytes } from '@noble/hashes/utils.js';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from './DirectMessageMailboxStore';

export type DirectMessageMailboxDelivery = 'delivered' | 'failed';

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
   * Sender. Appends the already-sent record to the recipient's inbox. Never
   * throws: any failure, including 404 for an inbox the recipient has not
   * opened yet, returns 'failed' so the caller can surface it.
   */
  public async deliver(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    sent: MessageResource,
  ): Promise<DirectMessageMailboxDelivery> {
    try {
      const keys = this.keysFor(session, conversationId, recipientIdentityId);
      const record = DirectMessageMailboxRecord.fromSent(conversationId, sent);

      await this.channel.send(keys, DirectMessageMailboxRecord.encode(record));

      return 'delivered';
    } catch {
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
      readToken: Buffer.from(
        randomBytes(DirectMessageMailbox.READ_TOKEN_BYTES),
      ).toString('base64url'),
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
