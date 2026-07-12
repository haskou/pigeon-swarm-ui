import type {
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CreateCommunityInvitationPort {
  createCommunityInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }>;
}
