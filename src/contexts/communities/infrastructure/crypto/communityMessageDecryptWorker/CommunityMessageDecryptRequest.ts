import type { MessageResource } from '../../../../../shared/domain/pigeonResources.types';

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
