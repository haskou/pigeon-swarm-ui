import type { MessagePinResource } from './MessagePinResource';

export type CommunityChannelMessagePinsResource = {
  channelId: string;
  communityId: string;
  pins: MessagePinResource[];
};
