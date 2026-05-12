import type { ConversationResource, LocalKeychain } from '../types';

export function conversationPeerIdentityId(
  conversation: ConversationResource,
  currentIdentityId: string,
  keychain?: LocalKeychain,
): string | undefined {
  if (conversation.type === 'group' || conversation.id.startsWith('group:')) {
    return undefined;
  }

  if (conversation.peerIdentityId) return conversation.peerIdentityId;

  const participantIds =
    conversation.participantIdentityIds ??
    conversation.participantIds ??
    conversation.participants ??
    [];
  const participantPeer = participantIds.find(
    (identityId) => identityId !== currentIdentityId,
  );

  if (participantPeer) return participantPeer;

  return keychain?.conversations[conversation.id]?.peerIdentityId;
}
