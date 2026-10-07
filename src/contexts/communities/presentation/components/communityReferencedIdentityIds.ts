import type {
  CommunityMembershipRequest,
  CommunityModerationLog,
} from '../../../../shared/domain/pigeonResources.types';

/**
 * Identities the manage dialog shows by name even though they are not (or no
 * longer) community members: banned identities, moderation log actors and
 * member targets, and membership request participants.
 */
export function communityReferencedIdentityIds({
  bannedMemberIds = [],
  membershipRequests = [],
  moderationLogs = [],
}: {
  bannedMemberIds?: readonly string[];
  membershipRequests?: readonly CommunityMembershipRequest[];
  moderationLogs?: readonly CommunityModerationLog[];
}): string[] {
  const identityIds = new Set<string>(bannedMemberIds);

  for (const request of membershipRequests) {
    identityIds.add(request.creatorIdentityId);
    identityIds.add(request.identityId);
  }

  for (const log of moderationLogs) {
    identityIds.add(log.actorIdentityId);

    if (log.target.type === 'member') identityIds.add(log.target.id);
  }

  return [...identityIds].filter((identityId) => identityId.length > 0);
}
