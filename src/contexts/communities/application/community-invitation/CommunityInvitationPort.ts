import type {
  Community,
  CommunityInviteLinkResource,
  ConversationKeyEntry,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CommunityInvitationPort {
  createCommunityInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }>;
  createCommunityInviteLink(
    session: Session,
    communityId: string,
    input?: { expiresAt?: number; maxUses?: number },
  ): Promise<{
    invite: CommunityInviteLinkResource;
    inviteSecret?: string;
    keyEntry?: ConversationKeyEntry;
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }>;
  getCommunityInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource>;
  acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community>;
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
