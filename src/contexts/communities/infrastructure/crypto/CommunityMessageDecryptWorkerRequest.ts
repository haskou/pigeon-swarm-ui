import type {
  ConversationKeyEntry,
  MessageResource,
} from '../../../../shared/domain/pigeonResources.types';

export type CommunityMessageDecryptWorkerRequest = {
  communityId: string;
  channelId: string;
  communityKey?: ConversationKeyEntry;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  requestId: number;
};
