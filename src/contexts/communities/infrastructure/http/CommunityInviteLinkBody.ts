import type { EncryptedCommunityKey } from '../crypto/communityInviteKeyEnvelope';
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';

export type CommunityInviteLinkBody = CommunityInviteLinkInput & {
  encryptedCommunityKey?: EncryptedCommunityKey;
};
