import type { CommunityChannelPayloadInput } from './CommunityChannelPayloadInput';

export type { CommunityChannelPlainPayload } from './CommunityChannelPlainPayload';
export type { CommunityChannelPayloadInput } from './CommunityChannelPayloadInput';
import { PublicKey } from '@haskou/value-objects';

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
    ...(input.threadRootMessageId
      ? { threadRootMessageId: input.threadRootMessageId }
      : {}),
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
