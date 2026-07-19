import type {
  ConversationResource,
  IdentityResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import { SharedNetworkSelectorDomainService } from '../../../../contexts/networks/domain/services/SharedNetworkSelectorDomainService';
import { NetworkId } from '../../../../contexts/networks/domain/value-objects/NetworkId';

export class WorkspaceConversationTarget {
  public static existingConversation(
    conversations: ConversationResource[],
    currentIdentityId: string,
    keychain: LocalKeychain,
    peerIdentityId: string,
  ): ConversationResource | undefined {
    return conversations.find((conversation) =>
      ConversationPeer.isWithIdentity(
        conversation,
        currentIdentityId,
        keychain,
        peerIdentityId,
      ),
    );
  }

  public static sharedNetwork(
    currentIdentityNetworks: string[],
    peerIdentity: IdentityResource | undefined,
    preferredNetworkId: string | undefined,
  ): NetworkId {
    return new SharedNetworkSelectorDomainService().select(
      currentIdentityNetworks.map((networkId) =>
        NetworkId.fromString(networkId),
      ),
      (peerIdentity?.networks ?? []).map((networkId) =>
        NetworkId.fromString(networkId),
      ),
      NetworkId.fromOptional(preferredNetworkId),
    );
  }
}
