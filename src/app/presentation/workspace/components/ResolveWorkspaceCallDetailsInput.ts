import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { LocalKeychain } from '../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';

export type ResolveWorkspaceCallDetailsInput = {
  call: CallResource;
  communities: Community[];
  conversations: ConversationResource[];
  currentIdentity: IdentityResource;
  fallbackLabels: {
    noConversation: string;
    privateCommunity: string;
    voiceChannel: string;
  };
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  keychain: LocalKeychain;
};
