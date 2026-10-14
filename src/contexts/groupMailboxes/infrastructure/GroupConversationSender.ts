import type { ConversationResource } from '../../conversations/infrastructure/http/ConversationResource';
import type { DirectMessageRecord } from '../../mailboxes/domain/DirectMessageRecord';
import type { MessagePayloadSeal } from '../../messages/infrastructure/crypto/MessagePayloadSeal';
import type { EditMessageOptions } from '../../messages/infrastructure/http/resources/EditMessageOptions';
import type { SendMessageOptions } from '../../messages/infrastructure/http/resources/SendMessageOptions';
import type { ChatMessage } from '../../messages/presentation/view-models/ChatMessage';
import type { GroupConversationMember } from './GroupConversationMember';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupMessageHistoryStore } from './history/GroupMessageHistoryStore';

import { DirectMailboxRecords } from '../../mailboxes/domain/DirectMailboxRecords';
import { DirectMessageMailboxRecord } from '../../messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { GroupMessageId } from './crypto/GroupMessageId';

/**
 * Writes group records. A payload is the plain message JSON: MLS encrypts
 * every record for the members of the current epoch, so no conversation key
 * exists. Every record id is bound to its author, as the inbox demands. MLS
 * cannot open a member's own messages, so each record is kept in this
 * device's history once it is queued. A queued record is sent even when that
 * copy fails, so a retry never sends it twice under a new id.
 */
export class GroupConversationSender {
  private static readonly PLAIN: MessagePayloadSeal = (plainMessage) =>
    plainMessage;

  public constructor(
    private readonly ports: Pick<
      GroupConversationPorts,
      'composer' | 'now' | 'projector'
    >,
    private readonly history: Pick<GroupMessageHistoryStore, 'append'>,
  ) {}

  private identity(member: GroupConversationMember) {
    return {
      createdAt: this.ports.now(),
      id: GroupMessageId.create(member.session.identity.id),
    };
  }

  private async enqueue(
    member: GroupConversationMember,
    record: DirectMessageRecord,
  ): Promise<void> {
    await member.outbox.enqueueMessage(
      record.conversationId,
      record.id,
      DirectMessageMailboxRecord.encode(record),
    );
    await this.history.append(member.session, [record]).catch(() => {
      // eslint-disable-next-line no-console
      console.debug('Group local copy failed.');
    });
  }

  private async write(
    member: GroupConversationMember,
    record: DirectMessageRecord,
  ): Promise<void> {
    await this.enqueue(member, {
      ...record,
      id: GroupMessageId.create(member.session.identity.id),
    });
  }

  public async send(
    member: GroupConversationMember,
    conversation: ConversationResource,
    content: string,
    options: SendMessageOptions,
  ): Promise<ChatMessage> {
    const sent = await this.ports.composer.withSentRecord(
      member.session,
      conversation.id,
      content,
      {
        ...options,
        attachmentUpload: {
          encryptLargeAttachments: true,
          encryptSmallAttachments: true,
          networkId: conversation.networkId,
        },
      },
      async (record) => {
        await this.enqueue(
          member,
          DirectMessageMailboxRecord.fromSent(conversation.id, record),
        );

        return record;
      },
      this.identity(member),
      GroupConversationSender.PLAIN,
    );

    return this.ports.projector.projectPlaintext(member.session, sent).message;
  }

  public async edit(
    member: GroupConversationMember,
    conversation: ConversationResource,
    messageId: string,
    content: string,
    options: EditMessageOptions,
  ): Promise<ChatMessage> {
    const edited = await this.ports.composer.composeEdit(
      member.session,
      conversation.id,
      messageId,
      content,
      options,
      this.identity(member),
      GroupConversationSender.PLAIN,
    );

    await this.enqueue(
      member,
      DirectMessageMailboxRecord.fromEdited(conversation.id, edited),
    );

    return this.ports.projector.projectPlaintext(member.session, edited)
      .message;
  }

  public async delete(
    member: GroupConversationMember,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.write(
      member,
      DirectMailboxRecords.deleted({
        authorId: member.session.identity.id,
        conversationId,
        targetMessageId: messageId,
      }),
    );
  }

  public async reaction(
    member: GroupConversationMember,
    conversationId: string,
    reaction: {
      action: 'add' | 'remove';
      createdAt: number;
      emoji: string;
      messageId: string;
    },
  ): Promise<void> {
    await this.write(
      member,
      DirectMailboxRecords.reaction({
        action: reaction.action,
        authorId: member.session.identity.id,
        conversationId,
        createdAt: reaction.createdAt,
        emoji: reaction.emoji,
        targetMessageId: reaction.messageId,
      }),
    );
  }

  public async pin(
    member: GroupConversationMember,
    conversationId: string,
    pin: { action: 'pin' | 'unpin'; createdAt: number; messageId: string },
  ): Promise<void> {
    await this.write(
      member,
      DirectMailboxRecords.pin({
        action: pin.action,
        authorId: member.session.identity.id,
        conversationId,
        createdAt: pin.createdAt,
        targetMessageId: pin.messageId,
      }),
    );
  }
}
