import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

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
