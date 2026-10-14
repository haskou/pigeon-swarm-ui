import type { ConversationAccessContexts } from '../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import type { ConversationResource } from '../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { MessageDeleter } from '../../../contexts/messages/application/delete-message/MessageDeleter';

import { DeleteMessageMessage } from '../../../contexts/messages/application/delete-message/messages/DeleteMessageMessage';

export class PigeonMessageWriter {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly conversationContexts: ConversationAccessContexts,
    private readonly deleter: MessageDeleter,
  ) {}

  public async delete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    this.identityContexts.register(session);
    this.conversationContexts.registerOpen(conversation);
    await this.deleter.delete(
      new DeleteMessageMessage({
        authorIdentityId: session.identity.id,
        conversationId: conversation.id,
        messageId,
      }),
    );
  }
}
