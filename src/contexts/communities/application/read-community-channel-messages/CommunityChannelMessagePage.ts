import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

export type CommunityChannelMessagePage = {
  messages: MessageResource[];
  nextBeforeMessageId?: null | string;
};
