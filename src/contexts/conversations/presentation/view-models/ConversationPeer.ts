import type {
  ConversationResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

export class ConversationPeer {
  public static isWithIdentity(
    conversation: ConversationResource,
    currentIdentityId: string,
    keychain: LocalKeychain,
    peerIdentityId: string,
  ): boolean {
    return (
      ConversationPeer.identityId(conversation, currentIdentityId, keychain) ===
      peerIdentityId
    );
  }

  public static identityId(
    conversation: ConversationResource,
    currentIdentityId: string,
    keychain?: LocalKeychain,
  ): string | undefined {
    if (conversation.type === 'group') return undefined;

    const peerIdentityId = conversation.participantIds.find(
      (identityId) => identityId !== currentIdentityId,
    );

    return (
      peerIdentityId ?? keychain?.conversations[conversation.id]?.peerIdentityId
    );
  }
}
