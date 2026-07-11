import type {
  ConversationResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

export class ConversationPeer {
  public static identityId(
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
    const peerIdentityId = participantIds.find(
      (identityId) => identityId !== currentIdentityId,
    );

    return (
      peerIdentityId ?? keychain?.conversations[conversation.id]?.peerIdentityId
    );
  }
}
