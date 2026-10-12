import { UUID } from '@haskou/value-objects';

import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { PigeonMessageCommandsApi } from '../http/PigeonMessageCommandsApi';
import type { EditMessageOptions } from '../http/resources/EditMessageOptions';
import type { SendMessageOptions } from '../http/resources/SendMessageOptions';
import type { DirectMessageRecord } from './DirectMessageMailboxRecord';
import type { DirectMessageOwnCopies } from './DirectMessageOwnCopies';
import type { RecipientMailboxRouter } from './RecipientMailboxRouter';

import { MailboxEnvelopeCipher } from '../../../mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { DirectMessageAuthorship } from './DirectMessageAuthorship';
import { DirectMessageInboxKeys } from './DirectMessageInboxKeys';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';

/** Count-only: no ids, content, or error details. */
function logAppendFailure(): void {
  // eslint-disable-next-line no-console
  console.debug('Direct mailbox append failed.');
}

/**
 * Sender path of the direct mailbox: every write goes to the peer's inbox
 * first, then to this identity's own inbox, so its other devices converge.
 */
export class DirectMessageSender {
  public constructor(
    private readonly recipients: RecipientMailboxRouter,
    private readonly projection: Pick<MessageProjectionPort, 'decrypt'>,
    private readonly composer: Pick<
      PigeonMessageCommandsApi,
      'composeEdit' | 'withSentRecord'
    >,
    private readonly ownCopies: DirectMessageOwnCopies,
  ) {}

  /**
   * The peer of a one-to-one conversation. Throws before any write when the
   * conversation is a group or has no other participant.
   */
  private peerOf(session: Session, conversation: ConversationResource): string {
    const peer = conversation.participantIds.find(
      (identityId) => identityId !== session.identity.id,
    );

    if (!peer || !DirectMessageMailboxRecord.isEligible(conversation.type)) {
      throw new Error('Direct mailbox needs a one-to-one conversation.');
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

    await this.writeTo(session, conversationId, recipientIdentityId, record);

    this.ownCopies.remember(`${session.identity.id}:${record.id}`);
    await this.appendOwnCopy(session, conversationId, record);
  }

  /**
   * The own copy is additive: a failure after the peer copy logs one
   * count-only line and resolves, so it never changes what the caller sees.
   */
  private async appendOwnCopy(
    session: Session,
    conversationId: string,
    record: DirectMessageRecord,
  ): Promise<void> {
    try {
      await this.writeTo(session, conversationId, session.identity.id, record);
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
        ? DirectMessageAuthorship.tag(session.masterKey.getBuffer(), record)
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
  ): Promise<void> {
    const plaintext = this.encodeFor(session, recipientIdentityId, record);

    if (plaintext.byteLength > MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES) {
      throw new Error('Direct mailbox record exceeds the envelope bound.');
    }

    const keys = DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      recipientIdentityId,
    );

    await this.recipients.send(recipientIdentityId, keys, plaintext);
  }

  /** Sender. Sends a message to the peer's inbox, then to the own inbox. */
  public async send(
    session: Session,
    conversation: ConversationResource,
    content: string,
    options: SendMessageOptions,
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
        await this.deliver(session, conversation.id, recipientIdentityId, () =>
          DirectMessageMailboxRecord.fromSent(conversation.id, record),
        );

        return record;
      },
    );

    return await this.projection.decrypt(session, conversation.id, sent);
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

    await this.deliver(session, conversation.id, recipientIdentityId, () => ({
      authorId: session.identity.id,
      conversationId: conversation.id,
      createdAt: Date.now(),
      id: UUID.generate().toString(),
      targetMessageId: messageId,
      type: 'deleted',
    }));
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

    await this.deliver(session, conversation.id, recipientIdentityId, () => ({
      action: reaction.action,
      authorId: session.identity.id,
      conversationId: conversation.id,
      createdAt: reaction.createdAt,
      emoji: reaction.emoji,
      id: UUID.generate().toString(),
      targetMessageId: reaction.messageId,
      type: 'reaction',
    }));
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

    await this.deliver(session, conversation.id, recipientIdentityId, () => ({
      action: pin.action,
      authorId: session.identity.id,
      conversationId: conversation.id,
      createdAt: pin.createdAt,
      id: UUID.generate().toString(),
      targetMessageId: pin.messageId,
      type: 'pin',
    }));
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
    if (!DirectMessageMailboxRecord.isEligible(conversation.type)) return;

    try {
      await this.writeTo(session, conversation.id, session.identity.id, {
        authorId: session.identity.id,
        conversationId: conversation.id,
        createdAt: Date.now(),
        id: UUID.generate().toString(),
        targetMessageId: messageId,
        type: 'read',
      });
    } catch {
      logAppendFailure();
    }
  }
}
