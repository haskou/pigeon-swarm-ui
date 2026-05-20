import type {
  Community,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/en';
import { CommunityChannels } from '../../../communities/domain/communityChannels';
import { ConversationPeer } from '../../../conversations/domain/conversationPeer';
import { identityDisplayName } from '../../../identities/presentation/view-models/identityDisplay';

export function communityNotificationPreview(
  communities: Community[],
  communityId: string,
  channelId: string,
  authorIdentityId: string | undefined,
  identityNames: Record<string, string>,
): { body: string; title: string } {
  const community = communities.find((item) => item.id === communityId);
  const channel = community
    ? CommunityChannels.all(community).find((item) => item.id === channelId)
    : undefined;
  const author = authorIdentityId ? identityNames[authorIdentityId] : undefined;
  const location = channel ? `#${channel.name}` : copy.chat.newMessage;

  return {
    body: author
      ? `${author} · ${location}`
      : `${location} · ${copy.chat.newMessage}`,
    title: community?.name ?? copy.communities.channelMessageNotification,
  };
}

export function conversationNotificationPreview(
  conversations: ConversationResource[],
  conversationId: string,
  session: Session,
  identityNames: Record<string, string>,
  identityProfiles: Record<string, IdentityResource>,
): { body: string; title: string } {
  const conversation = conversations.find((item) => item.id === conversationId);

  if (!conversation) {
    return { body: copy.chat.newMessage, title: copy.chat.directMessage };
  }

  if (conversation.type === 'group') {
    return {
      body: copy.chat.newMessage,
      title: conversation.name ?? conversation.title ?? copy.chat.groupMessage,
    };
  }

  return oneToOneConversationNotificationPreview(
    conversation,
    session,
    identityNames,
    identityProfiles,
  );
}

function oneToOneConversationNotificationPreview(
  conversation: ConversationResource,
  session: Session,
  identityNames: Record<string, string>,
  identityProfiles: Record<string, IdentityResource>,
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

  return { body: copy.chat.directMessage, title: peerName };
}
