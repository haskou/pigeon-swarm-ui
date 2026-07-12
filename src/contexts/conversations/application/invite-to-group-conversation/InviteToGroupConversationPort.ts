import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface InviteToGroupConversationPort {
  inviteToGroupConversation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void>;
}
