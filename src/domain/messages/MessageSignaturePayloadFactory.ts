import type { MessageSignaturePayload } from '../types';

export class MessageSignaturePayloadFactory {
  public createSent(input: {
    attachmentExternalIdentifiers: string[];
    authorId: string;
    conversationId: string;
    createdAt: number;
    encryptedPayload: string;
    id: string;
  }): MessageSignaturePayload {
    return {
      attachmentExternalIdentifiers: input.attachmentExternalIdentifiers,
      authorId: input.authorId,
      conversationId: input.conversationId,
      createdAt: input.createdAt,
      encryptedPayload: input.encryptedPayload,
      id: input.id,
      previousMessageIds: [],
      targetMessageId: undefined,
      type: 'sent',
    };
  }
}
