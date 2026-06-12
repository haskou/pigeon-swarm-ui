import type {
  ChatMessage,
  MessageResource,
} from '../../../shared/domain/pigeonResources.types';

export type MessageDecryptWorker = {
  decrypt(
    request: {
      conversationId: string;
      copy: {
        decryptFailed: string;
        missingKey: string;
      };
      currentIdentityId: string;
      messages: MessageResource[];
      symmetricKey?: string;
    },
    signal?: AbortSignal,
  ): Promise<ChatMessage[]>;
};
