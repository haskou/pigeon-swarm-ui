import type { ConversationAccessContexts } from '../../../conversations/infrastructure/http/ConversationAccessContexts';
import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { IdentityAccessContexts } from '../../../identities/infrastructure/http/IdentityAccessContexts';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { MessagePinChange } from '../../domain/MessagePinChange';
import type { MessageReactionChange } from '../../domain/MessageReactionChange';
import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';
import type { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';
import type { MessageConversationId } from '../../domain/value-objects/MessageConversationId';
import type { MessageId } from '../../domain/value-objects/MessageId';
import type { DirectMessageMailbox } from './DirectMessageMailbox';

import { ConversationId } from '../../../conversations/domain/value-objects/ConversationId';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';

/** Writes one-to-one deletes, pins and reactions as direct mailbox records. */
export class MailboxDirectMessageRepository implements DirectMessageRepository {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly conversationContexts: ConversationAccessContexts,
    private readonly mailbox: DirectMessageMailbox,
  ) {}

  private target(
    conversationId: MessageConversationId,
    actorId: MessageAuthorId,
  ): { conversation: ConversationResource; session: Session } {
    return {
      conversation: this.conversationContexts.findOpen(
        ConversationId.fromString(conversationId.toString()),
      ),
      session: this.identityContexts.find(
        IdentityId.fromString(actorId.toString()),
      ).session,
    };
  }

  public async delete(
    conversationId: MessageConversationId,
    messageId: MessageId,
    actorId: MessageAuthorId,
  ): Promise<void> {
    const { conversation, session } = this.target(conversationId, actorId);

    await this.mailbox.delete(session, conversation, messageId.toString());
  }

  public async pin(
    conversationId: MessageConversationId,
    change: MessagePinChange,
    actorId: MessageAuthorId,
  ): Promise<void> {
    const { conversation, session } = this.target(conversationId, actorId);

    await this.mailbox.pin(session, conversation, {
      action: change.getAction().isPin() ? 'pin' : 'unpin',
      createdAt: change.getCreatedAt().valueOf(),
      messageId: change.getMessageId().toString(),
    });
  }

  public async react(
    conversationId: MessageConversationId,
    change: MessageReactionChange,
    actorId: MessageAuthorId,
  ): Promise<void> {
    const { conversation, session } = this.target(conversationId, actorId);

    await this.mailbox.reaction(session, conversation, {
      action: change.getAction().isAdd() ? 'add' : 'remove',
      createdAt: change.getCreatedAt().valueOf(),
      emoji: change.getEmoji().toString(),
      messageId: change.getMessageId().toString(),
    });
  }
}
