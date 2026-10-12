/* eslint-disable @typescript-eslint/no-use-before-define */
import type { CommunityChannelMessagePayloadInput } from './CommunityChannelMessagePayloadInput';
import type { CommunityMessageMentionResource as CommunityMessageMention } from './resources/CommunityMessageMentionResource';

export type CommunityChannelMessageInput =
  CommunityChannelMessagePayloadInput & {
    id?: string;
    mentions?: CommunityMessageMention[];
    replyToMessageId?: string;
    timestamp?: number;
  };
