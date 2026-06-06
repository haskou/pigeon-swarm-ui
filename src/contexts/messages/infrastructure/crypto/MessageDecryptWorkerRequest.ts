import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

export type MessageDecryptWorkerRequest = {
  conversationId: string;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  privateKey?: string;
  requestId: number;
};
