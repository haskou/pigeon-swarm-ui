/** What an issuer chooses for a new invitation. */
export interface CommunityInvitationInput {
  expiresAt: number;
  /** The public half of the link's secret; the secret never leaves the UI. */
  invitationKey: string;
  invitee?: string;
  maxUses: number;
}
