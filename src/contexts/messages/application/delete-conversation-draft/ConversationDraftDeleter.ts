import type { ConversationDraftRepository } from '../../domain/repositories/ConversationDraftRepository';

import { DeleteConversationDraftMessage } from './messages/DeleteConversationDraftMessage';

export class ConversationDraftDeleter {
  public constructor(
    private readonly conversationDraftRepository: ConversationDraftRepository,
  ) {}

  public async delete(message: DeleteConversationDraftMessage): Promise<void> {
    await this.conversationDraftRepository.delete(
      message.getConversationId(),
      message.getActorIdentityId(),
    );
  }
}
