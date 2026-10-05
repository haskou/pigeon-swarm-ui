/* eslint-disable @typescript-eslint/no-use-before-define */
import type { CommunityMessageMention } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessagePayloadInput } from './CommunityChannelMessagePayloadInput';

export type CommunityChannelMessageEditInput =
  CommunityChannelMessagePayloadInput & {
    mentions?: CommunityMessageMention[];
    /** Stored fields of the edited message, kept by its signed record. */
    original: { createdAt: number; replyToMessageId?: string };
    timestamp?: number;
  };
