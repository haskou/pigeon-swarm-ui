import type { EncryptedCommunityKey } from '../crypto/communityInviteKeyEnvelope';
import type { CommunityInviteLinkBody } from './CommunityInviteLinkBody';
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';

export function buildCommunityInviteLinkBody(
  input: CommunityInviteLinkInput,
  encryptedCommunityKey?: EncryptedCommunityKey,
): CommunityInviteLinkBody {
  return {
    ...(encryptedCommunityKey ? { encryptedCommunityKey } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
  };
}
