import type { ConversationResource } from '../../conversations/infrastructure/http/ConversationResource';
import type { DirectMessageRecord } from '../../mailboxes/domain/DirectMessageRecord';
import type { DirectPollCloseRecord } from '../../mailboxes/domain/DirectPollCloseRecord';
import type { DirectPollRecord } from '../../mailboxes/domain/DirectPollRecord';
import type { DirectPollVoteRecord } from '../../mailboxes/domain/DirectPollVoteRecord';
import type { ChatMessage } from '../../messages/domain/ChatMessage';
import type { MessagePinChange } from '../../messages/domain/MessagePinChange';
import type { MessageReactionChange } from '../../messages/domain/MessageReactionChange';
import type { MessagePayloadSeal } from '../../messages/infrastructure/crypto/MessagePayloadSeal';
import type { EditMessageOptions } from '../../messages/infrastructure/http/resources/EditMessageOptions';
import type { SendMessageOptions } from '../../messages/infrastructure/http/resources/SendMessageOptions';
import type { GroupConversationMember } from './GroupConversationMember';
import type { GroupConversationPorts } from './GroupConversationPorts';
import type { GroupMessageHistoryStore } from './history/GroupMessageHistoryStore';

import { DirectMailboxRecords } from '../../mailboxes/domain/DirectMailboxRecords';
import { DirectMessageMailboxRecord } from '../../messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { PollBoard } from '../../polls/domain/PollBoard';
import { GroupMessageId } from './crypto/GroupMessageId';

/**
 * Writes group records. A payload is the plain message JSON: MLS encrypts
 * every record for the members of the current epoch, so no conversation key
 * exists. Every record id is bound to its author, as the inbox demands. MLS
 * cannot open a member's own messages, so each record is kept in this
 * device's history once it is queued. A queued record is sent even when that
 * copy fails, so a retry never sends it twice under a new id. A poll's
 * record id is the poll id; a poll the poll rules refuse is never queued.
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
    reaction: MessageReactionChange,
  ): Promise<void> {
    await this.write(
      member,
      DirectMailboxRecords.reaction({
        action: reaction.getAction().isAdd() ? 'add' : 'remove',
        authorId: member.session.identity.id,
        conversationId,
        createdAt: reaction.getCreatedAt().valueOf(),
        emoji: reaction.getEmoji().toString(),
        targetMessageId: reaction.getMessageId().toString(),
      }),
    );
  }

  public async pin(
    member: GroupConversationMember,
    conversationId: string,
    pin: MessagePinChange,
  ): Promise<void> {
    await this.write(
      member,
      DirectMailboxRecords.pin({
        action: pin.getAction().isPin() ? 'pin' : 'unpin',
        authorId: member.session.identity.id,
        conversationId,
        createdAt: pin.getCreatedAt().valueOf(),
        targetMessageId: pin.getMessageId().toString(),
      }),
    );
  }

  public async createPoll(
    member: GroupConversationMember,
    conversationId: string,
    poll: {
      allowsMultipleVotes: boolean;
      options: { id: string; text: string }[];
      question: string;
    },
  ): Promise<DirectPollRecord> {
    const { createdAt, id } = this.identity(member);
    const canonical = PollBoard.canonical({
      ...poll,
      createdAt,
      creatorIdentityId: member.session.identity.id,
      id,
    });
    const record = DirectMailboxRecords.poll({
      allowsMultipleVotes: canonical.allowsMultipleVotes,
      authorId: canonical.creatorIdentityId,
      conversationId,
      createdAt,
      id,
      options: canonical.options,
      question: canonical.question,
    });

    await this.enqueue(member, record);

    return record;
  }

  /** No option ids withdraws this identity's vote. */
  public async votePoll(
    member: GroupConversationMember,
    conversationId: string,
    pollId: string,
    optionIds: string[],
  ): Promise<DirectPollVoteRecord> {
    const { createdAt, id } = this.identity(member);
    const record = {
      ...DirectMailboxRecords.pollVote({
        authorId: member.session.identity.id,
        conversationId,
        createdAt,
        optionIds,
        targetPollId: pollId,
      }),
      id,
    };

    await this.enqueue(member, record);

    return record;
  }

  public async closePoll(
    member: GroupConversationMember,
    conversationId: string,
    pollId: string,
  ): Promise<DirectPollCloseRecord> {
    const { createdAt, id } = this.identity(member);
    const record = {
      ...DirectMailboxRecords.pollClose({
        authorId: member.session.identity.id,
        conversationId,
        createdAt,
        targetPollId: pollId,
      }),
      id,
    };

    await this.enqueue(member, record);

    return record;
  }
}
