import type {
  Community,
  ConversationResource,
  IdentityResource,
  MessageAttachment,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { CommunityChannels } from '../../../communities/domain/CommunityChannels';
import { ConversationPeer } from '../../../conversations/domain/ConversationPeer';
import { identityDisplayName } from '../../../identities/presentation/view-models/identityDisplay';

type NotificationMessagePreviewInput = {
  attachmentExternalIdentifiers?: string[];
  attachments?: MessageAttachment[];
  plaintextPayload?: string;
  publicPlaintext?: boolean;
};

const maxNotificationBodyLength = 160;

export function communityNotificationPreview(
  communities: Community[],
  communityId: string,
  channelId: string,
  authorIdentityId: string | undefined,
  identityNames: Record<string, string>,
  message?: MessageResource,
): { body: string; title: string } {
  const community = communities.find((item) => item.id === communityId);
  const channel = community
    ? CommunityChannels.all(community).find((item) => item.id === channelId)
    : undefined;
  const author = authorIdentityId ? identityNames[authorIdentityId] : undefined;
  const location = channel ? `#${channel.name}` : copy.chat.newMessage;
  const body = messageNotificationBody({
    attachmentExternalIdentifiers: message?.attachmentExternalIdentifiers,
    attachments: attachmentsFromPlaintextPayload(message?.plaintextPayload),
    plaintextPayload: message?.plaintextPayload,
    publicPlaintext: community?.visibility === 'public',
  });

  return {
    body,
    title: community
      ? `${community.name}${channel ? ` #${channel.name}` : ''}`
      : (author ? `${author} · ${location}` : location),
  };
}

export function conversationNotificationPreview(
  conversations: ConversationResource[],
  conversationId: string,
  session: Session,
  identityNames: Record<string, string>,
  identityProfiles: Record<string, IdentityResource>,
  message?: MessageResource,
): { body: string; title: string } {
  const conversation = conversations.find((item) => item.id === conversationId);

  if (!conversation) {
    return {
      body: messageNotificationBody({
        attachmentExternalIdentifiers: message?.attachmentExternalIdentifiers,
      }),
      title: copy.chat.directMessage,
    };
  }

  if (conversation.type === 'group') {
    return {
      body: messageNotificationBody({
        attachmentExternalIdentifiers: message?.attachmentExternalIdentifiers,
      }),
      title: conversation.name ?? conversation.title ?? copy.chat.groupMessage,
    };
  }

  return oneToOneConversationNotificationPreview(
    conversation,
    session,
    identityNames,
    identityProfiles,
    message,
  );
}

function oneToOneConversationNotificationPreview(
  conversation: ConversationResource,
  session: Session,
  identityNames: Record<string, string>,
  identityProfiles: Record<string, IdentityResource>,
  message?: MessageResource,
): { body: string; title: string } {
  const peerIdentityId = ConversationPeer.identityId(
    conversation,
    session.identity.id,
    session.keychain,
  );
  const peerIdentity = peerIdentityId
    ? identityProfiles[peerIdentityId]
    : undefined;
  const peerHandle = peerIdentity?.profile.handle?.trim();
  const peerName =
    peerIdentity?.profile.name.trim() ||
    (peerHandle ? `@${peerHandle}` : undefined) ||
    (peerIdentityId
      ? identityDisplayName(peerIdentityId, identityNames)
      : undefined) ||
    copy.chat.directMessage;

  return {
    body: messageNotificationBody({
      attachmentExternalIdentifiers: message?.attachmentExternalIdentifiers,
    }),
    title: peerName,
  };
}

export function messageNotificationBody(
  input: NotificationMessagePreviewInput,
): string {
  if (input.publicPlaintext) {
    const content = plaintextMessageContent(input.plaintextPayload);

    if (content) return truncateNotificationBody(content);
  }

  return (
    attachmentNotificationBody(
      input.attachments,
      input.attachmentExternalIdentifiers,
    ) ?? copy.chat.newMessage
  );
}

function plaintextMessageContent(
  plaintextPayload: string | undefined,
): string | undefined {
  const value = plaintextPayload?.trim();

  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as unknown;

    if (isRecord(parsed) && typeof parsed.content === 'string') {
      return nonEmptyString(parsed.content);
    }
  } catch {
    return value;
  }

  return value;
}

function attachmentsFromPlaintextPayload(
  plaintextPayload: string | undefined,
): MessageAttachment[] | undefined {
  if (!plaintextPayload) return undefined;

  try {
    const parsed = JSON.parse(plaintextPayload) as unknown;

    if (!isRecord(parsed) || !Array.isArray(parsed.attachments)) {
      return undefined;
    }

    return parsed.attachments.filter(isMessageAttachment);
  } catch {
    return undefined;
  }
}

function attachmentNotificationBody(
  attachments: MessageAttachment[] | undefined,
  attachmentExternalIdentifiers: string[] | undefined,
): string | undefined {
  if (attachments?.length) {
    const imageCount = attachments.filter(isImageAttachment).length;

    if (imageCount > 1) return copy.chat.sentAlbum;

    if (imageCount === 1) return copy.chat.sentPhoto;

    return copy.chat.sentFile;
  }

  return attachmentExternalIdentifiers?.length ? copy.chat.sentFile : undefined;
}

function isImageAttachment(attachment: MessageAttachment): boolean {
  return (
    attachment.contentType.toLowerCase().startsWith('image/') ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(attachment.filename)
  );
}

function isMessageAttachment(value: unknown): value is MessageAttachment {
  return (
    isRecord(value) &&
    typeof value.cid === 'string' &&
    typeof value.contentType === 'string' &&
    typeof value.filename === 'string' &&
    typeof value.size === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function truncateNotificationBody(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxNotificationBodyLength) return normalized;

  return `${normalized.slice(0, maxNotificationBodyLength - 1).trimEnd()}…`;
}
