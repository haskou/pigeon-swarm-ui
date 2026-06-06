/* eslint-disable @typescript-eslint/no-use-before-define */
import type { CommunityMessageMention } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessagePayloadInput } from './CommunityChannelMessagePayloadInput';

export type CommunityChannelMessageInput =
  CommunityChannelMessagePayloadInput & {
    attachmentExternalIdentifiers?: string[];
    id?: string;
    mentions?: CommunityMessageMention[];
    replyToMessageId?: string;
    timestamp?: number;
  };
