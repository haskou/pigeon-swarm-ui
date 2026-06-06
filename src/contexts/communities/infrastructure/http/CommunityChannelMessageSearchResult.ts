/* eslint-disable @typescript-eslint/no-use-before-define */
import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

export type CommunityChannelMessageSearchResult = {
  channelId?: string;
  messages: MessageResource[];
  nextBeforeMessageId?: null | string;
};
