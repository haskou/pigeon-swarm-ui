/* eslint-disable @typescript-eslint/no-use-before-define */
import type { CommunityChannelMessagePayloadInput } from './CommunityChannelMessagePayloadInput';
import type { CommunityMessageMentionResource as CommunityMessageMention } from './resources/CommunityMessageMentionResource';

export type CommunityChannelMessageEditInput =
  CommunityChannelMessagePayloadInput & {
    mentions?: CommunityMessageMention[];
    /** Stored fields of the edited message, kept by its signed record. */
    original: { createdAt: number; replyToMessageId?: string };
    timestamp?: number;
  };
