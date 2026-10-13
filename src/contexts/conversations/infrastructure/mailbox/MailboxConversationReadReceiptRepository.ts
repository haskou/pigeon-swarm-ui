import type { DirectMessageMailbox } from '../../../messages/infrastructure/mailbox/DirectMessageMailbox';
import type { ConversationReadReceiptRepository } from '../../domain/repositories/ConversationReadReceiptRepository';
import type { ConversationId } from '../../domain/value-objects/ConversationId';
import type { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';
import type { MessageId } from '../../domain/value-objects/MessageId';
import type { ConversationAccessContexts } from '../http/ConversationAccessContexts';

/** Sends one-to-one reads as read records through the direct mailbox. */
// eslint-disable-next-line max-len
export class MailboxConversationReadReceiptRepository implements ConversationReadReceiptRepository {
  public constructor(
    private readonly contexts: ConversationAccessContexts,
    private readonly mailbox: DirectMessageMailbox,
  ) {}

  public async markRead(
    conversationId: ConversationId,
    messageId: MessageId,
    actorIdentityId: ConversationParticipantId,
  ): Promise<void> {
    await this.mailbox.markRead(
      this.contexts.find(actorIdentityId),
      this.contexts.findOpen(conversationId),
      messageId.toString(),
    );
  }
}
