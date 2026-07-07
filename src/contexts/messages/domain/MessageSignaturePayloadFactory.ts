import type { MessageSignaturePayload } from '../../../shared/domain/pigeonResources.types';

export class MessageSignaturePayloadFactory {
  public createDeleted(input: {
    authorId: string;
    conversationId: string;
    createdAt: number;
    id: string;
    targetMessageId: string;
  }): MessageSignaturePayload {
    return {
      authorId: input.authorId,
      conversationId: input.conversationId,
      createdAt: input.createdAt,
      encryptedPayload: undefined,
      id: input.id,
      previousMessageIds: [input.targetMessageId],
      replyToMessageId: undefined,
      targetMessageId: input.targetMessageId,
      type: 'deleted',
    };
  }

  public createEdited(input: {
    authorId: string;
    conversationId: string;
    createdAt: number;
    encryptedPayload: string;
    id: string;
    targetMessageId: string;
  }): MessageSignaturePayload {
    return {
      authorId: input.authorId,
      conversationId: input.conversationId,
      createdAt: input.createdAt,
      encryptedPayload: input.encryptedPayload,
      id: input.id,
      previousMessageIds: [input.targetMessageId],
      replyToMessageId: undefined,
      targetMessageId: input.targetMessageId,
      type: 'edited',
    };
  }

  public createSent(input: {
    authorId: string;
    conversationId: string;
    createdAt: number;
    encryptedPayload: string;
    id: string;
    previousMessageIds?: string[];
    replyToMessageId?: string;
  }): MessageSignaturePayload {
    return {
      authorId: input.authorId,
      conversationId: input.conversationId,
      createdAt: input.createdAt,
      encryptedPayload: input.encryptedPayload,
      id: input.id,
      previousMessageIds: input.previousMessageIds ?? [],
      replyToMessageId: input.replyToMessageId,
      targetMessageId: undefined,
      type: 'sent',
    };
  }
}
