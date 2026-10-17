/** A pending claim of an invitation: the proofs a manager admits with. */
export interface CommunityInvitationClaimResource {
  communityId: string;
  consent: string;
  id: string;
  identityId: string;
  invitationId: string;
  possession: string;
}
