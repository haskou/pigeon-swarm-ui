import type {
  Community,
  ConversationKeyEntry,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface AcceptCommunityInviteLinkWithKeyPort {
  acceptCommunityInviteLinkWithKey(
    session: Session,
    inviteToken: string,
    keyEntry: ConversationKeyEntry,
  ): Promise<{
    community: Community;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }>;
}
