import type {
  ChatMessage,
  LoginResult,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface LoginIdentityPort {
  login(identityId: string, password: string): Promise<LoginResult>;

  loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    limit?: number,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }>;
}
