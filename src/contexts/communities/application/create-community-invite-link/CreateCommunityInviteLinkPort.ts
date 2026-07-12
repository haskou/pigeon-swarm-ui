import type {
  CommunityInviteLinkResource,
  ConversationKeyEntry,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CreateCommunityInviteLinkPort {
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
}
