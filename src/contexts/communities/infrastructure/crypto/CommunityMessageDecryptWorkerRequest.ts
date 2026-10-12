import type { MessageResource } from '../../../messages/infrastructure/http/MessageResource';

export type CommunityMessageDecryptWorkerRequest = {
  communityId: string;
  channelId: string;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  requestId: number;
};
