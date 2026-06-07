import type { CommunityMessageMention } from '../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessagePayloadInput } from './CommunityChannelMessagePayloadInput';

export type CommunityChannelMessageEditInput =
  CommunityChannelMessagePayloadInput & {
    attachmentExternalIdentifiers?: string[];
    mentions?: CommunityMessageMention[];
    timestamp?: number;
  };
