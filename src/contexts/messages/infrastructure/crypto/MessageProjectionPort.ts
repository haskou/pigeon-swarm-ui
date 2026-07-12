import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface MessageProjectionPort {
  decrypt(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage>;

  decryptMany(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]>;

  list(value: unknown): {
    messages: MessageResource[];
    nextCursor?: null | string;
  };
}
