/** A signed invitation as the node reports it to a member. */
export interface CommunityInvitationResource {
  createdAt: number;
  expiresAt: number;
  id: string;
  invitationKey: string;
  invitee?: string;
  issuerIdentityId: string;
  live: boolean;
  maxUses: number;
  revoked: boolean;
  uses: number;
}
