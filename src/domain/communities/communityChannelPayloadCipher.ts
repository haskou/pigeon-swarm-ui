import { PublicKey } from '@haskou/value-objects';

import type {
  ConversationKeyEntry,
  CommunityMessageMention,
  MessageAttachment,
  MessageLinkPreview,
  MessageReplyPreview,
  StickerMessageReference,
} from '../types';

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

type EncryptCommunityChannelPayloadInput = {
  attachments: MessageAttachment[];
  authorIdentityId: string;
  channelId: string;
  communityKey?: ConversationKeyEntry;
  communityId: string;
  content: string;
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  timestamp: number;
};

export function encryptCommunityChannelPayload(
  input: EncryptCommunityChannelPayloadInput,
): string {
  if (!input.communityKey) {
    throw new Error('Community key is required to encrypt channel messages.');
  }

  const plaintext = JSON.stringify({
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
    type: input.sticker
      ? 'CommunityChannelStickerMessageSent'
      : 'CommunityChannelMessageSent',
  });

  return PublicKey.fromPEM(input.communityKey.publicKey)
    .encrypt(plaintext)
    .toString();
}
