import type { ConversationResource } from '../../infrastructure/http/ConversationResource';
import type { LocalKeychain } from '../../../identities/infrastructure/keychain/LocalKeychain';

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
