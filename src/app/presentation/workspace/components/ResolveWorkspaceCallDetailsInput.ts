import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type {
  Community,
  ConversationResource,
  IdentityResource,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

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
