import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';

import { applicationContainer } from '../../../composition/applicationContainer';

/**
 * Routes a command on a conversation message to its transport: a group
 * message goes through the MLS group mailbox, a one-to-one message through
 * the direct mailbox.
 */
export class ConversationMessageCommands {
  private static isGroup(conversation: ConversationResource): boolean {
    return conversation.type === 'group';
  }

  public static async delete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    if (ConversationMessageCommands.isGroup(conversation)) {
      await applicationContainer.groupMessages.delete(
        session,
        conversation,
        messageId,
      );

      return;
    }

    await applicationContainer.messages.delete(
      session,
      conversation,
      messageId,
    );
  }

  public static async edit(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    content: string,
  ): Promise<ChatMessage> {
    const mailbox = ConversationMessageCommands.isGroup(conversation)
      ? applicationContainer.groupMessages
      : applicationContainer.directMessages;

    return await mailbox.edit(session, conversation, messageId, content, {});
  }

  public static async pin(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    action: 'pin' | 'unpin',
  ): Promise<void> {
    if (ConversationMessageCommands.isGroup(conversation)) {
      await applicationContainer.groupMessages.pin(session, conversation, {
        action,
        messageId,
      });

      return;
    }

    await (action === 'pin'
      ? applicationContainer.messages.pin(session, conversation, messageId)
      : applicationContainer.messages.unpin(session, conversation, messageId));
  }

  public static async react(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    emoji: string,
    action: 'add' | 'remove',
  ): Promise<void> {
    if (ConversationMessageCommands.isGroup(conversation)) {
      await applicationContainer.groupMessages.reaction(session, conversation, {
        action,
        emoji,
        messageId,
      });

      return;
    }

    const messages = applicationContainer.messages;

    await (action === 'add'
      ? messages.addReactionTo(session, conversation, messageId, emoji)
      : messages.removeReactionFrom(session, conversation, messageId, emoji));
  }
}
