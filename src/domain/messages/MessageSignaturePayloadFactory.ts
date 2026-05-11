import type { MessageSignaturePayload } from '../types';

export class MessageSignaturePayloadFactory {
  public createDeleted(input: {
    authorId: string;
    conversationId: string;
    createdAt: number;
    id: string;
    targetMessageId: string;
  }): MessageSignaturePayload {
    return {
      attachmentExternalIdentifiers: [],
      authorId: input.authorId,
      conversationId: input.conversationId,
      createdAt: input.createdAt,
      encryptedPayload: undefined,
      id: input.id,
      previousMessageIds: [input.targetMessageId],
      targetMessageId: input.targetMessageId,
      type: 'deleted',
    };
  }

  public createSent(input: {
    attachmentExternalIdentifiers: string[];
    authorId: string;
    conversationId: string;
    createdAt: number;
    encryptedPayload: string;
    id: string;
    previousMessageIds?: string[];
    replyToMessageId?: string;
  }): MessageSignaturePayload {
    return {
      attachmentExternalIdentifiers: input.attachmentExternalIdentifiers,
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
