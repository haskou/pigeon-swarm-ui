/* eslint-disable @typescript-eslint/no-use-before-define */
import type { MessageResource } from '../../../messages/infrastructure/http/MessageResource';

export type CommunityChannelMessageSearchResult = {
  channelId?: string;
  messages: MessageResource[];
  nextBeforeMessageId?: null | string;
};
