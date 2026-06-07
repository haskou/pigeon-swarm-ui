import type { EncryptedCommunityKey } from '../../../contexts/communities/infrastructure/crypto/communityInviteKeyEnvelope';
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';

export type CommunityInviteLinkBody = CommunityInviteLinkInput & {
  encryptedCommunityKey?: EncryptedCommunityKey;
};
