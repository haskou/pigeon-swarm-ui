import type { MessageResource } from '../http/MessageResource';

export type MessageDecryptWorkerRequest = {
  conversationId: string;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  symmetricKey?: string;
  requestId: number;
};
