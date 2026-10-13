import { UUID } from '@haskou/value-objects';

import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { ChatMessage } from '../../presentation/view-models/ChatMessage';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { PigeonMessageCommandsApi } from '../http/PigeonMessageCommandsApi';
import type { EditMessageOptions } from '../http/resources/EditMessageOptions';
import type { MessageCommandIdentity } from '../http/resources/MessageCommandIdentity';
import type { SendMessageOptions } from '../http/resources/SendMessageOptions';
import type {
  DirectMessageOutboxEvent,
  DirectMessageOutboxItem,
} from './DirectMessageOutbox';
import type { DirectMessageOutboxStore } from './DirectMessageOutboxStore';
import type { DirectMessageOwnCopies } from './DirectMessageOwnCopies';
import type { RecipientMailboxRouter } from './RecipientMailboxRouter';

import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { DirectMailboxEligibility } from '../../../mailboxes/domain/DirectMailboxEligibility';
import { DirectMailboxOwnership } from '../../../mailboxes/domain/DirectMailboxOwnership';
import { DirectMailboxRecordError } from '../../../mailboxes/domain/DirectMailboxRecordError';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { MailboxEnvelopeCipher } from '../../../mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageAuthorship } from './DirectMessageAuthorship';
import { DirectMessageInboxKeys } from './DirectMessageInboxKeys';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageOutbox } from './DirectMessageOutbox';

/** Refuses a record the envelope cannot carry, before anything is written. */
function assertWithinEnvelope(plaintext: Uint8Array): void {
  if (plaintext.byteLength > MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES) {
    throw new Error('Direct mailbox record exceeds the envelope bound.');
  }
}

/**
 * The envelope id of one queued copy. A retry or a reload re-posts the same
 * id to the same inbox, so the node keeps one copy rather than two.
 */
function queuedEnvelopeId(sendId: string, recipientIdentityId: string): string {
  return MailboxChannel.envelopeIdFor(
    `direct-send\u0000${recipientIdentityId}\u0000${sendId}`,
  );
}

/** Count-only: no ids, content, or error details. */
function logAppendFailure(): void {
  // eslint-disable-next-line no-console
  console.debug('Direct mailbox append failed.');
}

/**
 * A peer inbox that is not open yet is retried for this long, then the send
 * rejects.
 */
const PEER_INBOX_RETRY_WINDOW_MS = 30_000;
const PEER_INBOX_RETRY_FIRST_DELAY_MS = 250;
const PEER_INBOX_RETRY_MAX_DELAY_MS = 4_000;

/**
 * Sender path of the direct mailbox: every write goes to the peer's inbox
 * first, then to this identity's own inbox, so its other devices converge.
 */
export class DirectMessageSender {
  private readonly outbox: DirectMessageOutbox;

  public constructor(
    private readonly recipients: RecipientMailboxRouter,
    private readonly projection: Pick<
      MessageProjectionPort,
      'decrypt' | 'decryptMany'
    >,
    private readonly composer: Pick<
      PigeonMessageCommandsApi,
      'composeEdit' | 'withSentRecord'
    >,
    private readonly ownCopies: DirectMessageOwnCopies,
    outboxStore: DirectMessageOutboxStore,
  ) {
    this.outbox = new DirectMessageOutbox(outboxStore, {
      toOwn: (session, row) => {
        this.ownCopies.remember(
          DirectMailboxOwnership.ownCopyKey(session.identity.id, row.record.id),
        );

        return this.appendOwnCopy(
          session,
          row.conversationId,
          row.record,
          queuedEnvelopeId(row.id, session.identity.id),
        );
      },
      toPeer: (session, row) =>
        this.writeTo(
          session,
          row.conversationId,
          row.peerIdentityId,
          row.record,
          queuedEnvelopeId(row.id, row.peerIdentityId),
        ),
    });
  }

  /**
   * The peer of a one-to-one conversation. Throws before any write when the
   * conversation is a group or has no other participant.
   */
  private peerOf(session: Session, conversation: ConversationResource): string {
    const peer = conversation.participantIds.find(
      (identityId) => identityId !== session.identity.id,
    );

    if (!peer || !DirectMailboxEligibility.isEligible(conversation.type)) {
      throw new DirectMailboxRecordError(
        'Direct mailbox needs a one-to-one conversation.',
      );
    }

    return peer;
  }

  /**
   * Sender path shared by every direct write. Builds the record once, so the
   * peer copy and the own copy carry the same id. The peer copy goes first; its
   * failure rejects with the original error and no own copy is written.
   */
  private async deliver(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    build: () => DirectMessageRecord,
  ): Promise<void> {
    const record = build();

    await this.appendToPeer(
      session,
      conversationId,
      recipientIdentityId,
      record,
    );

    this.ownCopies.remember(
      DirectMailboxOwnership.ownCopyKey(session.identity.id, record.id),
    );
    await this.appendOwnCopy(session, conversationId, record);
  }

  /**
   * The peer's inbox exists only once the peer has opened the conversation, so
   * a send can run ahead of it. An absent inbox is retried with capped backoff
   * for the window; any other failure, or the window passing, rejects.
   */
  private async appendToPeer(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    record: DirectMessageRecord,
  ): Promise<void> {
    const deadline = Date.now() + PEER_INBOX_RETRY_WINDOW_MS;
    let delayMs = PEER_INBOX_RETRY_FIRST_DELAY_MS;

    for (;;) {
      try {
        await this.writeTo(
          session,
          conversationId,
          recipientIdentityId,
          record,
        );

        return;
      } catch (error) {
        if (!(error instanceof MailboxUnavailableError)) throw error;

        if (Date.now() + delayMs > deadline) throw error;
      }

      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, delayMs);
      });
      delayMs = Math.min(delayMs * 2, PEER_INBOX_RETRY_MAX_DELAY_MS);
    }
  }

  /**
   * The own copy is additive: a failure after the peer copy logs one
   * count-only line and resolves, so it never changes what the caller sees.
   */
  private async appendOwnCopy(
    session: Session,
    conversationId: string,
    record: DirectMessageRecord,
    envelopeId?: string,
  ): Promise<void> {
    try {
      await this.writeTo(
        session,
        conversationId,
        session.identity.id,
        record,
        envelopeId,
      );
    } catch {
      logAppendFailure();
    }
  }

  /**
   * Encodes a record for one inbox. Only this identity's own inbox gets the
   * authorship tag, because only that inbox is checked for it on read.
   */
  private encodeFor(
    session: Session,
    recipientIdentityId: string,
    record: DirectMessageRecord,
  ): Uint8Array {
    return DirectMessageMailboxRecord.encode(
      record,
      recipientIdentityId === session.identity.id
        ? DirectMessageAuthorship.tag(
            sessionRootKey(session).getBuffer(),
            record,
          )
        : undefined,
    );
  }

  /**
   * Encodes one record for one inbox, enforces the envelope bound, and appends
   * it through the recipient router. Throws before any append when the record
   * is over the bound, so nothing is written.
   */
  private async writeTo(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    record: DirectMessageRecord,
    envelopeId?: string,
  ): Promise<void> {
    const plaintext = this.encodeFor(session, recipientIdentityId, record);

    assertWithinEnvelope(plaintext);

    const keys = DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      recipientIdentityId,
    );

    await this.recipients.send(
      recipientIdentityId,
      keys,
      plaintext,
      envelopeId,
    );
  }

  /**
   * Checks that a record can be written to one inbox: it fits the envelope and
   * its conversation key resolves. Throws before anything is persisted.
   */
  private assertWritable(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    record: DirectMessageRecord,
  ): void {
    assertWithinEnvelope(this.encodeFor(session, recipientIdentityId, record));
    DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      recipientIdentityId,
    );
  }

  /**
   * Sender. Persists the built record in the outbox, then resolves: the peer
   * copy and the own copy are written in the background. An absent peer inbox
   * is retried; any other failure marks the send failed. Rejects before
   * anything is persisted when the record cannot be sent.
   */
  public async send(
    session: Session,
    conversation: ConversationResource,
    content: string,
    options: SendMessageOptions,
    commandIdentity?: MessageCommandIdentity,
  ): Promise<ChatMessage> {
    const recipientIdentityId = this.peerOf(session, conversation);

    const sent = await this.composer.withSentRecord(
      session,
      conversation.id,
      content,
      {
        ...options,
        attachmentUpload: {
          encryptLargeAttachments: true,
          encryptSmallAttachments: true,
          networkId: conversation.networkId,
          recipientIdentityId,
        },
      },
      async (record) => {
        const built = DirectMessageMailboxRecord.fromSent(
          conversation.id,
          record,
        );

        this.assertWritable(
          session,
          conversation.id,
          recipientIdentityId,
          built,
        );
        await this.outbox.enqueue(session, {
          conversationId: conversation.id,
          peerIdentityId: recipientIdentityId,
          record: built,
        });

        return record;
      },
      commandIdentity,
    );

    return await this.projection.decrypt(session, conversation.id, sent);
  }

  /**
   * Sender. Re-queues a one-to-one send held in the outbox and resolves with
   * its message. Null when the outbox holds no such send.
   */
  public async retry(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<ChatMessage | null> {
    this.peerOf(session, conversation);

    const item = this.outbox
      .items(session.identity.id, conversation.id)
      .find((entry) => entry.id === messageId);

    if (!item || !this.outbox.retry(session, messageId)) return null;

    return await this.projection.decrypt(
      session,
      conversation.id,
      DirectMessageMailboxRecord.toResource(item.record),
    );
  }

  /**
   * Sender. Queued one-to-one sends of a conversation, decrypted in the order
   * the outbox holds them. Their states come from `items`.
   */
  public async queued(
    session: Session,
    conversationId: string,
  ): Promise<ChatMessage[]> {
    const records = this.outbox
      .items(session.identity.id, conversationId)
      .map((item) => DirectMessageMailboxRecord.toResource(item.record));

    return await this.projection.decryptMany(session, conversationId, records);
  }

  /** Re-queues every persisted send of this identity, after unlock. */
  public async resume(session: Session): Promise<void> {
    await this.outbox.resume(session);
  }

  /** Queued one-to-one sends of one conversation, each with its state. */
  public items(
    identityId: string,
    conversationId: string,
  ): DirectMessageOutboxItem[] {
    return this.outbox.items(identityId, conversationId);
  }

  /** Notifies on each outbox state change. Returns the unsubscribe function. */
  public subscribe(
    listener: (event: DirectMessageOutboxEvent) => void,
  ): () => void {
    return this.outbox.subscribe(listener);
  }

  /** Stops this identity's sends in memory, for logout. Rows are kept. */
  public stop(identityId: string): void {
    this.outbox.stop(identityId);
  }

  /** Cancels and wipes this identity's queued sends, for forget. */
  public async cancel(identityId: string): Promise<void> {
    await this.outbox.cancel(identityId);
  }

  /** Sender. Edits a sent message. Rejects like send. */
  public async edit(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    content: string,
    options: EditMessageOptions,
  ): Promise<ChatMessage> {
    const recipientIdentityId = this.peerOf(session, conversation);
    const edited = await this.composer.composeEdit(
      session,
      conversation.id,
      messageId,
      content,
      options,
    );

    await this.deliver(session, conversation.id, recipientIdentityId, () =>
      DirectMessageMailboxRecord.fromEdited(conversation.id, edited),
    );

    return await this.projection.decrypt(session, conversation.id, edited);
  }

  /** Sender. Deletes a message by id. Rejects like send. */
  public async delete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    const recipientIdentityId = this.peerOf(session, conversation);

    await this.deliver(session, conversation.id, recipientIdentityId, () =>
      DirectMailboxRecords.deleted({
        authorId: session.identity.id,
        conversationId: conversation.id,
        createdAt: Date.now(),
        id: UUID.generate().toString(),
        targetMessageId: messageId,
      }),
    );
  }

  /** Sender. Adds or removes a reaction. Rejects like send. */
  public async reaction(
    session: Session,
    conversation: ConversationResource,
    reaction: {
      action: 'add' | 'remove';
      createdAt: number;
      emoji: string;
      messageId: string;
    },
  ): Promise<void> {
    const recipientIdentityId = this.peerOf(session, conversation);

    await this.deliver(session, conversation.id, recipientIdentityId, () =>
      DirectMailboxRecords.reaction({
        action: reaction.action,
        authorId: session.identity.id,
        conversationId: conversation.id,
        createdAt: reaction.createdAt,
        emoji: reaction.emoji,
        id: UUID.generate().toString(),
        targetMessageId: reaction.messageId,
      }),
    );
  }

  /** Sender. Pins or unpins a message. Rejects like send. */
  public async pin(
    session: Session,
    conversation: ConversationResource,
    pin: {
      action: 'pin' | 'unpin';
      createdAt: number;
      messageId: string;
    },
  ): Promise<void> {
    const recipientIdentityId = this.peerOf(session, conversation);

    await this.deliver(session, conversation.id, recipientIdentityId, () =>
      DirectMailboxRecords.pin({
        action: pin.action,
        authorId: session.identity.id,
        conversationId: conversation.id,
        createdAt: pin.createdAt,
        id: UUID.generate().toString(),
        targetMessageId: pin.messageId,
      }),
    );
  }

  /**
   * Sender. Writes a read receipt to this identity's own inbox, so its other
   * devices clear unread. The peer never receives it. Never rejects: a failure
   * logs one count-only line. Writes nothing for a group conversation.
   */
  public async markRead(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    if (!DirectMailboxEligibility.isEligible(conversation.type)) return;

    try {
      await this.writeTo(
        session,
        conversation.id,
        session.identity.id,
        DirectMailboxRecords.read({
          authorId: session.identity.id,
          conversationId: conversation.id,
          createdAt: Date.now(),
          id: UUID.generate().toString(),
          targetMessageId: messageId,
        }),
      );
    } catch {
      logAppendFailure();
    }
  }
}
