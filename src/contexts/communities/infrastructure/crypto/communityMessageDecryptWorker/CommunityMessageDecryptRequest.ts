import type {
  ConversationKeyEntry,
  MessageResource,
} from '../../../../../shared/domain/pigeonResources.types';

export type CommunityMessageDecryptRequest = {
  channelId: string;
  communityId: string;
  communityKey?: ConversationKeyEntry;
  copy: {
    decryptFailed: string;
    missingKey: string;
  };
  currentIdentityId: string;
  messages: MessageResource[];
  requestId: number;
};
