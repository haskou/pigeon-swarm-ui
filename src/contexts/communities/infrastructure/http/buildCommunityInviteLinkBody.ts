import type { CommunityInviteLinkBody } from './CommunityInviteLinkBody';
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';

export function buildCommunityInviteLinkBody(
  input: CommunityInviteLinkInput,
): CommunityInviteLinkBody {
  return {
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
  };
}
