import type { CommunityMessageMention } from '../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessagePayloadInput } from './CommunityChannelMessagePayloadInput';

export type CommunityChannelMessageInput =
  CommunityChannelMessagePayloadInput & {
    id?: string;
    mentions?: CommunityMessageMention[];
    replyToMessageId?: string;
    timestamp?: number;
  };
