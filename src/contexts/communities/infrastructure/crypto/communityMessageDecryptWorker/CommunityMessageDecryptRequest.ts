import type { MessageResource } from '../../../../messages/infrastructure/http/MessageResource';

export type CommunityMessageDecryptRequest = {
  channelId: string;
  communityId: string;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  requestId: number;
};
