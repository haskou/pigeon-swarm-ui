/* eslint-disable @typescript-eslint/no-use-before-define */
import type { CommunityMessageMention } from '../../../../shared/domain/pigeonResources.types';

export type CommunityChannelMessageRequestBody = {
  attachmentExternalIdentifiers: string[];
  createdAt: number;
  encryptedPayload?: string;
  id?: string;
  mentions: CommunityMessageMention[];
  plaintextPayload?: string;
  replyToMessageId?: string;
  signature: string;
};
