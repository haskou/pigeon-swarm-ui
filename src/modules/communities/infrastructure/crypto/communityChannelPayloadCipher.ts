import { PublicKey } from '@haskou/value-objects';

import type {
  ConversationKeyEntry,
  CommunityMessageMention,
  MessageAttachment,
  MessageLinkPreview,
  MessageReplyPreview,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

export type CommunityChannelPlainPayload = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  channelId?: string;
  communityId?: string;
  content?: string;
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  reply?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  timestamp?: number;
  type?: string;
};

export type CommunityChannelPayloadInput = {
  attachments: MessageAttachment[];
  authorIdentityId: string;
  channelId: string;
  communityKey?: ConversationKeyEntry;
  communityId: string;
  content: string;
  eventType?: 'CommunityChannelMessageEdited';
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  timestamp: number;
};

function communityChannelPayloadType(
  input: CommunityChannelPayloadInput,
): string {
  if (input.eventType) return input.eventType;

  if (input.sticker) return 'CommunityChannelStickerMessageSent';

  return 'CommunityChannelMessageSent';
}

export function serializeCommunityChannelPayload(
  input: CommunityChannelPayloadInput,
): string {
  return JSON.stringify({
    attachments: input.attachments,
    authorIdentityId: input.authorIdentityId,
    channelId: input.channelId,
    communityId: input.communityId,
    content: input.content,
    ...(input.linkPreview ? { linkPreview: input.linkPreview } : {}),
    ...(input.mentions?.length ? { mentions: input.mentions } : {}),
    ...(input.replyPreview ? { reply: input.replyPreview } : {}),
    ...(input.replyToMessageId
      ? { replyToMessageId: input.replyToMessageId }
      : {}),
    ...(input.sticker ? { sticker: input.sticker } : {}),
    timestamp: input.timestamp,
    type: communityChannelPayloadType(input),
  });
}

export function encryptCommunityChannelPayload(
  input: CommunityChannelPayloadInput,
): string {
  if (!input.communityKey) {
    throw new Error('Community key is required to encrypt channel messages.');
  }

  const plaintext = serializeCommunityChannelPayload(input);

  return PublicKey.fromPEM(input.communityKey.publicKey)
    .encrypt(plaintext)
    .toString();
}
